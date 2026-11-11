# Plan de test du MVP INFLUX

> **Date :** 2026-09-18
> **Auteur :** agent `testeur`
> **Statut :** **plan de test arrêté — ouvert aux objections de `expert-cybersecurite`,
> `expert-conformite-rgpd` et `architecte`**, dont les points sont listés au §9.
> **Skill appliquée :** `test-strategy`, complétée par `security-rgpd-audit` pour les lots touchant
> des données personnelles.
> **Révisé le 2026-09-25** (vérification de fin de J1 du Lot 0, `21` §4 J1-A à J1-I) : §5 (G5,
> annexes 1 et 2), T7, T8, T13, T17, TM11, §10 (Lots 0 et 1), totaux (§0, §3.2, §10, §11).
> **Révisé le 2026-09-26** (J2, EC-1 et EC-20 tranchés par `expert-cybersecurite`, `03` P7) : T2,
> T3, T4, T6 et T16 précisés pour être codés sans supposer ; `influx_service` et
> `ELEVATED_DATABASE_URL` retirés ; §3 (tests en base et poste sans Docker), §9.1 (C-3, C-7 à C-9),
> §9.3 (A-1), §9.5 (nouveau), §10 (Lot 0), totaux.
> **Révisé le 2026-09-27** (vérification de fin de J2, `21` §3 EC-35 tranché) : §3 (plancher,
> chemin de connexion), T2 (forme `vide`, code de refus d'un déclencheur, exclusions de T2.2, essai
> `delete` des formes `propre`), T3.7, T3.8, T4.7, T6.3 (exemptions), T16.5.
> **Révisé le 2026-10-28** (jalon DS, D73, charte KEO Emerald ; `02` §21) : §3.2 (ligne du jalon),
> §5.1 (nouveau : gardes G3 à G3h, G4f, G8, G9), §8 (lignes 15 à 22), §9.3 (A-7 à A-9), §10 (jalon DS,
> entre le Lot 1 et le Lot 2), §11 (compte des zones non couvertes), §12 (nouveau : familles TD1 à TD8,
> matrice de largeurs, plan par commit, recette humaine).
>
> **Ce document reprend et exécute** les tests T1 à T17 exigés au §8 de
> `docs/mvp/03-matrice-des-droits-et-rls.md` et les contrôles X1 à X4 de son §5.3, comme le demande
> son §11. Il reprend aussi le sort des gardes existantes décidé au §13 de
> `docs/mvp/02-architecture-3-espaces.md`.
>
> **Source de vérité :** `CLAUDE.md`. En cas d'écart, `CLAUDE.md` prime et c'est ce document qui est
> corrigé. En matière de droits et de RLS, `docs/mvp/03-matrice-des-droits-et-rls.md` fait foi et ce
> document en est l'exécution testable.

---

## 0. Ce qu'il faut retenir si l'on ne lit qu'une page

**Trois phrases pour le fondateur.**

1. **La zone la plus testée du projet n'est plus le calcul de la commission — il n'y en a pas.**
   L'arbitrage A1 sort le contrat et le paiement de l'application : aucune ligne de code ne
   multiplie un montant par un taux. La place laissée vacante est prise par **l'anonymisation des
   profils créateurs**, parce qu'un pseudo qui fuit avant l'ouverture d'une mise en relation, c'est
   une commission qui ne sera jamais facturée.
2. **La deuxième zone est le registre d'audit.** C'est la seule chose qu'INFLUX pourra produire le
   jour où une affaire sera conclue dans son dos. Un registre réécrivable ne prouve rien, et
   personne ne s'en apercevrait sans un test fait exprès pour ça.
3. **Rien de tout cela ne coûte plus cher que de le découvrir après.** Le plan représente environ
   **211 cas de test** *(205 + 6, D67, 2026-10-17)* répartis en 29 familles, un corpus figé de 120 messages piégés, et **un seul**
   parcours complet de bout en bout. C'est délibérément peu de tests, mais tous choisis.

**Ce que ce plan ne prétend pas faire.** Il n'empêche pas deux personnes majeures de s'entendre en
dehors d'INFLUX (`01-intermediation-courtee.md` §10). Il ne remplace pas un test d'intrusion externe
(F-9). Il ne teste pas la sincérité de la saisie d'un commercial. Ces trous sont listés au §8, et ils
sont volontaires.

---

## 1. En-tête : portée, public, limites

### 1.1 Ce que ce document couvre

| Sujet | Couvert |
|---|---|
| Stratégie et niveau de test de chaque règle du MVP (Lots 0 à 6) | Oui |
| Les 17 tests de sécurité exigés par `expert-cybersecurite` (§8 du document `03`), traduits en cas exécutables | Oui |
| Les tests métier du MVP : leads, consentement, révélation d'identité, file, transitions, montants, détection | Oui |
| Le sort des gardes existantes de `apps/web` et leur contrepartie | Oui |
| La définition du « prêt à livrer », lot par lot, vérifications humaines comprises | Oui |
| Le corpus de détection de coordonnées et ses seuils | Oui |
| Le parcours de bout en bout du Lot 6 | Oui |

### 1.2 Ce que ce document ne couvre pas

| Sujet | Qui le porte |
|---|---|
| Le choix de l'outillage de test structurant (base jetable, navigateur automatisé, harnais de rôles) — je **recommande**, je ne tranche pas | `architecte` (§9.3) |
| La configuration concrète de l'intégration continue, les secrets de CI, la durée d'exécution acceptable | `integrateur` |
| Les critères d'acceptation fonctionnels lot par lot — ce plan les consommera quand ils existeront | `product-owner` |
| La légalité des traitements, les durées de conservation, le contenu des journaux | `expert-conformite-rgpd` |
| La rédaction des politiques RLS, des contraintes et des déclencheurs | `expert-database` |
| L'audit de sécurité et le test d'intrusion du Lot 6 | `expert-cybersecurite` + prestataire externe |
| Les tests de charge et de performance | **Non planifiés au MVP** — voir §8 |

### 1.3 Les six règles non négociables de ce plan

1. **Aucun test ne touche un service externe réel.** Brevo, Apollo et tout prestataire d'envoi sont
   doublés. Un e-mail réellement envoyé depuis la CI est un incident, pas une gêne.
2. **Les tests sont déterministes.** Un test instable est traité comme un test cassé : on le répare
   ou on le supprime, jamais on ne le relance « pour voir ». Budget d'instabilité toléré : **zéro**.
3. **Aucune donnée personnelle réelle** dans un jeu de test, ni dans le corpus de détection, ni dans
   `staging` (constat bloquant B9).
4. **Un bug corrigé donne lieu à un test de non-régression** qui échoue avant le correctif.
5. **On teste le comportement, pas l'implémentation.** Un refactoring ne doit casser aucun test ; une
   exception assumée : les gardes structurelles (§4), dont c'est précisément le rôle de casser.
6. **La CI bloque la livraison** si `typecheck`, `lint`, les tests ou les gardes échouent.

---

## 2. Les zones critiques, par gravité décroissante

### 2.1 L'ordre retenu, et pourquoi il diffère légèrement de l'ordre proposé

L'ordre de priorité de `CLAUDE.md` et de la skill `test-strategy` est : **perte d'argent > fuite de
données > perte de lead > gêne**. Au MVP, la perte d'argent ne passe plus par un calcul faux, elle
passe par **une mise en relation qu'INFLUX a produite et qu'il ne peut ni empêcher ni prouver**.

J'ai retenu sept zones. **Deux corrections** par rapport à l'ordre proposé, argumentées ci-dessous :

| # | Zone | Ordre proposé | Ordre retenu | Motif |
|---|---|---|---|---|
| Z1 | Anonymisation et RLS | 1 | **1** | Confirmé |
| Z2 | Registre append-only chaîné | 2 | **2** | Confirmé |
| Z3 | Authentification, session, autorisation par rôle | 4 | **3** — **remonté** | Un compte `agent` pris expose **toutes** les identités et **toutes** les conversations d'un coup. C'est le même dommage que Z1, en une fois et sans effraction technique. Il passe donc devant la perte de lead |
| Z4 | Consentement marketing et pipeline de leads | 3 | **4** — **descendu** | Risque réel mais de nature différente : sanction réglementaire et lead perdu. Grave, non instantané, et réversible par un rejeu |
| Z5 | Transitions d'état et concurrence (file, mise en relation, affaire, badge) | 5 | **5** | Confirmé. J'y rapatrie la **file de validation**, qui est un problème de concurrence et de verrou, pas d'authentification |
| Z6 | Saisie des montants dans le pipeline commercial | 7 | **6** — **remonté** | C'est **la seule mesure du chiffre d'affaires d'INFLUX** (indicateur n° 1 du cadrage). Un montant écrasé sans trace est un revenu perdu et non reconstituable |
| Z7 | Détection de coordonnées | 6 | **7** — **descendu** | `01-intermediation-courtee.md` §2 la classe **cinquième et dernière** des protections, et §M5 dit qu'elle « documente, ne prévient pas ». La tester en priorité donnerait un faux sentiment de sécurité |

### 2.2 Les sept zones, une par une

---

#### **Z1 — Anonymisation des profils créateurs et cloisonnement RLS**

> **Le risque, en une phrase pour le fondateur :** *si une marque obtient un pseudo, un `@` ou un lien
> avant qu'un commercial n'ait ouvert la mise en relation, elle contacte le créateur directement, la
> décision A2 ne vaut plus rien, et INFLUX ne verra jamais un euro de cette affaire.*

| | |
|---|---|
| **Nature du risque** | **Perte d'argent immédiate** *et* fuite de données personnelles. Cumul des deux premiers rangs de gravité |
| **Pourquoi c'est la zone n° 1** | La fuite est **silencieuse** : aucune alerte, aucune erreur, aucun symptôme. Une colonne ajoutée au Lot 5, un visuel de portfolio non modéré, un nom de fichier bavard suffisent (`03` §0) |
| **Niveau de test** | **Intégration, sur la charge utile brute** (T1) et **au niveau de la base, rôle par rôle** (T2). Un test unitaire sur un objet de transfert ne prouve rien : c'est ce qui sort de l'API qui compte |
| **Complément indispensable** | Une garde **statique** : aucun type exposé à une marque ne porte de champ identifiant (garde annexe promue en règle permanente, §4) |
| **Échec bloquant** | Toute occurrence d'un marqueur identifiant dans le corps sérialisé d'une réponse, un en-tête ou une URL rendue à un rôle `advertiser` sans mise en relation révélée. **Une seule occurrence suffit à bloquer la livraison du lot** ; il n'existe pas d'occurrence « mineure » |
| **Échec bloquant, second volet** | Toute table de nos schémas sans `relrowsecurity`, sans `relforcerowsecurity`, sans politique, ou absente de la table d'attendus dérivée de la matrice du document `03` §3 |

---

#### **Z2 — Le registre d'audit append-only chaîné**

> **Le risque, en une phrase :** *si le journal peut être réécrit, INFLUX n'a plus rien à opposer le
> jour où une affaire est conclue dans son dos — et il ne s'en apercevra pas, puisque c'est
> précisément la trace de l'événement qui aura disparu.*

| | |
|---|---|
| **Nature du risque** | Perte d'argent **différée** : la preuve de l'intermédiation fonde la créance de la V2 et la crédibilité commerciale d'une réclamation |
| **Pourquoi juste derrière Z1** | Le dommage est aussi grave, mais il ne se matérialise qu'en cas de litige. Z1 fuit tous les jours ; Z2 fuit une fois, au pire moment |
| **Niveau de test** | **Intégration, en base uniquement.** Aucun test applicatif ne prouve l'inviolabilité : il faut tenter les opérations interdites avec chaque rôle réel |
| **Ce qui est testé** | Les quatre couches du principe P8 : absence de droit, déclencheur, chaînage par empreinte, vérification. Plus la **détection effective d'une altération** — une chaîne qu'on ne sait pas vérifier n'est pas une chaîne |
| **Échec bloquant** | Un `UPDATE`, `DELETE` ou `TRUNCATE` qui réussit avec un rôle d'exécution. Une altération simulée que la vérification **ne détecte pas**. Une bifurcation de chaîne acceptée. Un trou de séquence après une transaction annulée |
| **Étendu à** | `identity.terms_acceptances`, `messaging.messages`, `messaging.conversation_access_log`, `identity.consent_events`, `billing.deal_field_changes` — mêmes tests, même exigence |

---

#### **Z3 — Authentification, session et autorisation par rôle**

> **Le risque, en une phrase :** *un compte de commercial pris par un tiers donne accès à l'intégralité
> des identités créateurs et de toutes les conversations du produit ; un compte membre pris expose une
> personne.*

| | |
|---|---|
| **Nature du risque** | Fuite de données **à l'échelle**, et accès à la surface qui décide des mises en relation |
| **Pourquoi devant le pipeline de leads** | Un lead non synchronisé se rejoue ; un annuaire de créateurs exfiltré ne se rejoue pas |
| **Niveau de test** | **Intégration** (codes à usage unique, sessions, révocation, `aal2`), **unitaire** pour les règles pures (validité d'un code, fenêtre de temps, calcul d'un plafond) |
| **Le cas le plus important** | **Le tir groupé** : demander un code pour 10 000 adresses et tenter `000000` sur chacune. C'est le seul scénario qui casse le dispositif à l'échelle, et il n'est arrêté que par la limitation par IP et la surveillance globale (A-3) |
| **Le cas le plus subtil** | **La réponse identique, en contenu et en temps**, pour une adresse connue et inconnue (A-5). Voir §3, T8.5 : je refuse d'en faire un test au chronomètre, qui serait instable ; il est remplacé par un test du chemin d'exécution |
| **Échec bloquant** | Deux codes valides simultanément. Une session qui survit à une suspension. Une route du backoffice atteignable sans `aal2`. Un changement d'adresse e-mail sans double confirmation. Un cookie de session porteur d'un jeton autoportant |

---

#### **Z4 — Consentement marketing et pipeline de synchronisation des leads**

> **Le risque, en une phrase :** *un lead qui n'arrive pas dans Brevo est un lead perdu ; un lead qui y
> arrive sans consentement est une infraction — et c'est le seul risque de ce plan qui peut coûter une
> amende avant d'avoir rapporté un euro.*

| | |
|---|---|
| **Nature du risque** | Perte de lead (indicateur n° 5 : 99 % sous 1 h, aucun échec laissé sans traitement) **et** risque réglementaire (A7 / D33, veto `expert-conformite-rgpd` maintenu) |
| **Niveau de test** | **Intégration avec doublures** pour le pipeline ; **unitaire** pour les règles de décision (consentement, catégorie de profil, interrupteur Apollo) |
| **Les quatre invariants testés** | (a) un échec Brevo ou Apollo ne fait **jamais** échouer une inscription ; (b) le rejeu est **idempotent** ; (c) **aucune synchronisation sans consentement**, revérifié **à la consommation** et non à l'émission (C(35)) ; (d) une désinscription se propage et **revient** dans `identity.consent_events` |
| **Le cas que l'on oublie** | L'**interrupteur par catégorie de profil** exigé par R-8 : il doit exister et être testé **avant** que le juriste ne demande de restreindre, sinon la restriction devient un redéveloppement en urgence |
| **Échec bloquant** | Une inscription perdue à cause d'un tiers. Un doublon créé par un rejeu. Un envoi vers Brevo ou Apollo sans ligne de consentement valide au moment de l'appel. Un échec de la file laissé sans cause lisible au backoffice |

---

#### **Z5 — Transitions d'état et concurrence**

> **Le risque, en une phrase :** *un état incohérent — une affaire signée sans montant, une mise en
> relation révélée sans validation, une demande traitée deux fois par deux commerciaux — produit une
> donnée fausse qui se propage jusqu'au chiffre d'affaires.*

| | |
|---|---|
| **Nature du risque** | Donnée financière fausse (argent) et gêne opérationnelle (double traitement) |
| **Niveau de test** | **Unitaire** pour la machine à états de `packages/domain` ; **intégration en base** pour la vérité — la base reste l'arbitre (`02` §10.2, point 6). Les deux sont exigés : une transition refusée en TypeScript et acceptée en SQL est un défaut |
| **Concurrence** | Testée réellement, pas supposée : deux transactions simultanées sur la même demande de file, deux révélations simultanées, deux écritures de registre simultanées |
| **Échec bloquant** | Toute transition absente de `billing.deal_state_transitions` qui aboutit. Une révélation sans les deux acceptations. Deux commerciaux titulaires de la même demande. Un badge périmé encore actif après passage de la tâche de fond |

---

#### **Z6 — Saisie des montants dans le pipeline commercial**

> **Le risque, en une phrase :** *le pipeline commercial est la seule chose qui dise à INFLUX combien il
> gagne ; un montant mal contrôlé, écrasé sans trace ou saisi dans la mauvaise devise fausse
> directement le chiffre d'affaires du pilote.*

| | |
|---|---|
| **Nature du risque** | Perte d'argent, par mesure fausse plutôt que par calcul faux |
| **Niveau de test** | **Intégration en base** : toutes les règles sont déclaratives (contraintes `CHECK`, déclencheurs). C'est voulu, et c'est ce qui rend le test simple et durable |
| **Le point de doctrine** | **Aucun calcul de commission n'est testé, parce qu'il ne doit pas exister.** Le test correspondant (T16) est un test d'**absence** : on vérifie qu'aucune multiplication d'un montant par une constante n'apparaît dans `apps/` ni `packages/`, et que `billing.commission_rates` est vide et inaccessible en écriture |
| **Échec bloquant** | Un montant négatif ou nul accepté. Une commission supérieure au montant négocié acceptée sans justification. Un montant en flottant. Une devise hors liste. Une `signed_at` antérieure à `identity_revealed_at`. Une modification de montant sans ligne dans `billing.deal_field_changes`. **Toute trace d'un taux dans le code** |

---

#### **Z7 — Détection de coordonnées**

> **Le risque, en une phrase :** *la détection ne protège rien ; elle alerte un commercial qui est déjà
> dans le fil — mais si elle crie au loup à chaque URL produit d'un brief, il cessera de la lire, et
> elle n'aura servi à rien.*

| | |
|---|---|
| **Nature du risque** | Gêne, et perte de confiance dans un signal. Le risque d'argent est déjà couvert par la présence du commercial |
| **Niveau de test** | **Unitaire, sur un corpus figé** (§6). Le détecteur est une fonction pure : c'est le cas d'école du test unitaire |
| **Seuil bloquant, et il est asymétrique** | **Zéro faux positif** sur la liste blanche de messages légitimes (bloquant) ; **aucune régression** sur les cas déjà détectés (bloquant) ; **un seuil de rappel** fixé au Lot 4 après la première mesure, **non bloquant au départ** parce qu'un rappel exigé trop haut pousse à durcir le détecteur, donc à produire des faux positifs, donc à tuer le signal |
| **Ce qui n'est pas testable** | Un numéro dit en visioconférence, photographié, ou donné dans un salon. C'est écrit au §10 du document `01` et cela reste vrai |

---

## 3. Les tests exigés par `expert-cybersecurite`, traduits en cas exécutables

**Convention de lecture.** Chaque test T porte : son **niveau**, son **déclencheur en CI**, son
**critère d'échec**, et ses **cas numérotés** (`T1.1`, `T1.2`…). Les extraits de code sont des
**illustrations** destinées à `dev-react-node` et à `expert-database` : ce document n'écrit aucun test
réel et ne crée aucun fichier applicatif.

**Déclencheurs de CI utilisés :**

| Code | Signification |
|---|---|
| **À chaque exécution** | Sur chaque `push` sur `main` (la dérogation du fondateur du 2026-09-17 supprime les Pull Requests) |
| **À chaque exécution + hebdomadaire** | Idem, plus une exécution planifiée : une vulnérabilité publiée n'attend pas notre prochain commit |
| **Avant déploiement** | En plus, sur l'image construite, avant la mise en ligne d'un environnement |
| **Nocturne (worker)** | Pas un test de CI : une tâche de fond qui alerte. Distingué explicitement, parce qu'un contrôle non déterministe n'a rien à faire dans une CI bloquante |

**Où tournent les tests en base** *(ajouté le 2026-09-26)*. T2, T3, T4 (hors parties unitaires de
T4.6 et T4.8), T6.4, T6.5, T16.3, T16.4 et T16.5 exigent une vraie base : la **pile Supabase locale**
(`supabase start`, puis `supabase db reset`), qui tourne dans des conteneurs, ou la CI qui la lance
(`21` J2, point 7). **Au 2026-09-26, Docker n'est pas installé sur le poste de développement** : ces
tests ne peuvent donc tourner qu'en CI. *(Installé depuis : pile locale en service au J2, `21` J2.)* L'exigence ne change pas pour autant :

1. **« Vert » veut dire vert en local et en CI** (`21` §2.5). Tant que le poste n'a pas de moteur de
   conteneurs (Docker, ou un moteur compatible accepté par la CLI Supabase — choix d'`integrateur`),
   aucun jalon portant des tests en base (J2 et suivants) n'est déclaré terminé. L'installation est
   un **prérequis du J2**, à faire avant la première migration : développement direct sur `main`
   oblige, une migration poussée sans essai local rend `main` rouge pour tout le monde.
2. **Jamais sautés en silence.** Les tests en base forment un ensemble distinct, compris dans
   `pnpm check`. Base injoignable ⇒ **échec**, avec un message qui dit quoi faire (« pile Supabase
   locale absente : lancer `supabase start` »), jamais « ignoré ». En CI, un `.skip` ou un `.todo`
   dans cet ensemble, ou un nombre de cas exécutés inférieur au plancher déclaré par famille, fait
   échouer l'exécution. *Tranché le 2026-09-27 (EC-35, point 5) :* au J2, seule la garde statique
   (`.skip`, `.todo`, `.skipIf`, `.runIf`, `.only` refusés dans `db-tests/`) est en place ; elle ne
   voit ni un saut dynamique (`context.skip()`) ni un cas supprimé. **Le plancher est exigé au J3,
   avant le premier commit qui ajoute un test en base** : la CI lit le rapport JSON de Vitest du
   projet `db`, exige zéro cas sauté ou `todo`, et, par fichier, un nombre de cas exécutés au moins
   égal au plancher d'un fichier versionné (valeurs de départ : les effectifs constatés au J2,
   87 cas). Baisser un plancher se fait dans un commit qui le dit.
3. **Ce qui tourne sans base**, pour itérer en attendant : T6.1 à T6.3, T6.6, T16.1, T16.2, T16.6,
   T16.7, les parties unitaires de T4.6 et T4.8, et l'épreuve des analyseurs sur fichiers témoins
   (T6). Ce sous-ensemble peut être lancé seul, mais **il ne vaut jamais « vert »** au sens du §10.
4. **Chemin de connexion.** `03` P7 (règle 7) demande que la CI passe par le multiplexeur local en
   mode transaction ; en pile locale, la connexion est directe (EC-20). Les cas de T4 sont écrits
   pour tenir sur les deux chemins ; le choix pour la CI reste à confirmer par `integrateur`.
   *Tranché le 2026-09-27 (EC-35, point 7) :* **la CI se connecte en direct** (port 54322,
   multiplexeur non démarré, budget de temps), ce qui est accepté aux J2 et J3. Le mode transaction
   est précisément celui où un état de session fuit d'une requête à l'autre : **au J4, avant de
   déclarer `staging` prêt, T4.5, T4.6 e et T4.7 sont rejoués une fois par le multiplexeur** (pile
   locale avec Supavisor, ou `staging`), résultat consigné dans `21` J4.

---

### T1 — Anonymisation de bout en bout, sur la charge utile brute

| | |
|---|---|
| **Niveau** | Intégration (API + base réelle, jetable) |
| **Lot** | 2, étendu à 3, rejoué à chaque lot ultérieur |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | **Une seule occurrence** d'un marqueur identifiant dans une réponse destinée à un rôle `advertiser` sans mise en relation révélée |

**Le principe, et pourquoi il est différent de tous les autres tests.** On ne vérifie pas une liste de
champs attendus — on cherche **des chaînes de caractères dans le corps sérialisé de la réponse**. Une
liste de champs ne détecte que ce que l'on a anticipé ; la recherche dans la charge utile brute
attrape le champ imprévu, l'objet imbriqué oublié, le message d'erreur bavard et l'URL signée qui
porte un nom de fichier.

```ts
// Illustration — apps/api/tests/anonymisation.test.ts (à écrire par dev-react-node)
const MARQUEURS = [
  "@pseudo_test_zz",                 // pseudo
  "https://instagram.com/test_zz",   // lien de réseau
  "Marie-Test Dupont-Zz",            // nom légal
  "creator.test.zz@example.invalid", // e-mail de contact
  "+33600000000",                    // téléphone
  "story-marie-instagram.png",       // nom de fichier d'origine
  "CREATOR-ACCOUNT-UUID-ZZ",         // identifiant de compte (corrélation)
];

for (const route of inventaireDesRoutesDuRôleAnnonceur()) {   // dérivé du routeur, pas écrit à la main
  const réponse = await appeler(route, { jeton: jetonAnnonceurSansMiseEnRelation });
  const brut = JSON.stringify(réponse.body) + JSON.stringify(réponse.headers);
  for (const marqueur of MARQUEURS) {
    expect(brut, `${route.method} ${route.url} laisse fuir ${marqueur}`).not.toContain(marqueur);
  }
}
```

| Cas | Ce qu'il vérifie |
|---|---|
| **T1.1** | Balayage de **toutes** les routes accessibles au rôle `advertiser`, base peuplée de marqueurs : aucun marqueur dans le corps, les en-têtes, ni une URL renvoyée |
| **T1.2** | **L'inventaire des routes est dérivé du routeur Fastify**, jamais écrit à la main. Une route ajoutée au Lot 5 est balayée d'office. Un inventaire manuel pourrit en trois semaines et donne un faux sentiment de sécurité. *Emplacement réel (L2D-10) : `apps/api/db-tests/t1-anonymisation.test.ts`, inventaire lu du crochet `onRoute` (`routeInventoryOf`), `/health` seul exclu.* |
| **T1.3** | **Le contre-test** : après création d'une mise en relation avec `identity_revealed_at` non nul, le champ attendu **apparaît**. Sans lui, un test qui passe pourrait simplement signifier que la route est cassée |
| **T1.4** | Les réponses **d'erreur** (403, 404, 409, 422, 500 provoquée) ne contiennent aucun marqueur. C'est le chemin qu'on oublie de regarder |
| **T1.5** | Aucun marqueur dans une **URL signée** émise pour un annonceur (portfolio), ni dans le chemin d'objet du Storage |
| **T1.6** | Symétrie D40, précisée par D46 (2026-09-24) : **aucune coordonnée directe** d'une marque (e-mail, téléphone, page de contact) n'apparaît pour un rôle `creator`, **ni avant ni après** la révélation ; seul le prénom de l'interlocuteur est servi après révélation. Même contrôle dans l'autre sens : aucune coordonnée directe d'un créateur pour un rôle `advertiser` |

---

### T2 — RLS par rôle et par table, et échec de la CI sur toute table non déclarée

| | |
|---|---|
| **Niveau** | Intégration, **en base**, avec les vrais rôles PostgreSQL |
| **Lot** | 0, étendu à chaque lot qui crée une table |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Un accès autorisé là où la matrice dit `—` ou `⛔` ; ou **toute table de nos schémas absente de la table d'attendus** |

**La table d'attendus.** Un fichier de données versionné (`21` J2, point 6), dérivé de la matrice du §3
du document `03`, portant pour chaque triplet (**rôle Postgres**, table, opération SQL) le résultat
attendu **et sa forme**. Distinguer les formes n'est pas un raffinement : c'est ce qui permet de voir
qu'une protection a glissé d'une couche à l'autre. *Précisé le 2026-09-26 (EC-1, `03` P7) :*

| Forme | Ce que le test exige |
|---|---|
| `refus_droit` | `has_table_privilege` (ou `has_column_privilege`) est **faux**, et la tentative lève `42501` |
| `filtré` | Le droit existe ; `select`, `update`, `delete` voient ou touchent **zéro ligne alors que le rôle de migration en voit au moins une** ; `insert` lève `42501` par la politique (`WITH CHECK`) |
| `propre` | Le droit existe ; seules les lignes rattachées au compte du contexte (A) sont vues ou touchées, **jamais** celles de B |
| `autorisé` | Le droit existe ; l'opération aboutit sur le gabarit de ligne de la table (puis la transaction est annulée) |
| `vide` | *Ajoutée le 2026-09-27 (EC-35, point 1).* Le droit de lecture existe ; `select` voit **zéro ligne** et le rôle de migration aussi (table vide par construction). Réservée à `billing.commission_rates` lue par `influx_admin` (`03` C(32), `0007`) ; toute autre table déclarée `vide` exige l'accord de `testeur` |

**Code de refus d'un déclencheur** *(EC-35, point 2)*. Quand un déclencheur `BEFORE` refuse avant la
politique, la table déclare le code attendu (`filteredInsertCode`, ex. `23503` pour
`identity.terms_acceptances`, dont le déclencheur lit la version avec les droits de l'appelant). Ce
code n'est admis **que sans contexte** ; avec contexte, l'insertion au nom du compte B doit toujours
lever `42501` par la politique, ce qui prouve que la couche RLS tient seule.

**Essais `update` et `delete` des formes `propre`** *(EC-35, relevé de fin de J2)*. L'essai porte
`where <colonne du compte> = $1` : d'abord le compte A (au moins une ligne touchée), puis le compte B
(zéro ligne). Au J2, l'essai `delete` n'a pas ce filtre ; c'est sans effet tant qu'aucune table n'a de
`delete` `propre`, mais le contrôle du compte B serait alors vide de sens (les lignes de B, si elles
fuyaient, auraient déjà été supprimées et comptées avec celles de A). **À corriger avant la première
ligne d'attendus `delete` `propre`.**

Règles d'écriture du fichier, pour qu'il se code sans supposer :

1. **Une colonne par rôle Postgres, pas par rôle métier.** La colonne `service` du §3 de `03` ne
   désigne aucun rôle : elle se répartit entre `influx_auth` et `influx_worker` selon la liste fermée
   de `03` P7 et les `GRANT` écrits de `04`. **Au J2, `influx_auth` n'a aucun droit de table**
   (`03` P7 : ses droits arrivent au J3 avec `0012` à `0015`) : toutes ses lignes sont `refus_droit`.
2. **Chaque ligne cite sa source** (ligne et condition du §3 de `03`, ou `GRANT` de `04`). Une ligne
   sans source fait échouer la lecture du fichier ; une cellule absente vaut `refus_droit`. Le refus
   est le défaut, jamais l'exception.
3. **Chaque table déclare un gabarit de ligne valide** pour les essais d'`insert`, et le jeu de
   données de T2 (voir ci-dessous) y place **au moins une ligne**, sauf `billing.commission_rates` qui
   reste vide (T16.3) : sa lecture par `influx_admin` est `vide`, tout le reste `refus_droit`. Sans ligne présente, `filtré` ne se
   distingue pas d'une table vide et le test ne prouve rien.
4. **Les tables en ajout seul portent un marqueur** (`append_only`) : T3.1 et T3.2 s'y appliquent
   d'office dès qu'elles existent.
5. **Chemin de connexion réel.** Les quatre rôles métier sont pris depuis `influx_app`,
   `influx_auth` depuis `influx_auth_login`, `influx_worker` depuis `influx_worker_login`, par
   `SET LOCAL ROLE` — jamais depuis le rôle de migration. C'est ainsi que les appartenances de
   `03` P7 sont éprouvées en même temps que les droits. Les trois propriétaires de fonctions
   `SECURITY DEFINER` n'ayant aucun membre, leurs droits sont vérifiés **au catalogue** (T2.7).
6. **Jeu de données de T2** : chargé une fois par exécution, après `supabase db reset`, par le rôle
   de migration ; au moins deux comptes (A et B) par rôle métier ; données synthétiques uniquement
   (§1.3, règle 3). Il vit avec le harnais (`packages/test-kit`), **pas** dans `supabase/seed`, qui
   alimente `staging`.

```sql
-- Illustration — le recensement qui fait échouer la CI (cas T2.2)
-- « Nos schémas » = la liste déclarée dans le fichier d'attendus ; T2.2 vérifie aussi qu'aucun
-- schéma appartenant au rôle de migration n'est hors de cette liste (hors supabase_migrations).
select n.nspname || '.' || c.relname as table_manquante
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p')
   and n.nspname = any ($1::text[])          -- schémas déclarés
   and (not c.relrowsecurity
        or not c.relforcerowsecurity
        or not exists (select 1 from pg_policies p
                        where p.schemaname = n.nspname and p.tablename = c.relname));
-- Toute ligne renvoyée = CI rouge.
```

| Cas | Ce qu'il vérifie |
|---|---|
| **T2.1** | Chaque rôle Postgres pris à l'exécution (**J2 :** `influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin`, `influx_auth`, `influx_worker` ; `influx_ops` au J4, `influx_privacy` au Lot 5) tente `select`, `insert`, `update` et `delete` sur chaque table ; résultat et **forme** comparés au fichier d'attendus. Rôles métier exécutés avec le contexte complet du compte A (`aal2` pour `influx_agent` et `influx_admin`). Exécution par transactions annulées regroupées (A-4) |
| **T2.2** | **Échec de la CI sur toute table nouvelle** : `relrowsecurity` et `relforcerowsecurity` vrais, au moins une politique, et une ligne dans la table d'attendus. Trois conditions, trois raisons d'échouer, message distinct pour chacune. **Et** : aucun schéma appartenant au rôle de migration hors de la liste déclarée (exclusions nommées, liste fermée du fichier d'attendus : `supabase_migrations`, `_realtime` et `extensions`, créés par Supabase sous `postgres` — EC-35, point 3 ; toute nouvelle exclusion exige l'accord de `testeur` ; **au J3**, condition d'`expert-cybersecurite` : aucun rôle `influx_%` ne détient de droit sur ces schémas exclus ni sur leurs objets) ; aucune table, vue ni fonction de nos objets dans `public` (P6) ; toute vue de nos schémas porte `security_invoker = true` (P5) |
| **T2.3** | **Échec de la CI sur toute ligne d'attendus orpheline** (une table supprimée dont les attendus restent) : sinon la table d'attendus devient un cimetière et perd sa valeur de recensement |
| **T2.4** | `PUBLIC`, `anon`, `authenticated` et `service_role` n'ont **aucun droit** sur nos schémas (`has_schema_privilege` `USAGE` et `CREATE` faux), ni sur aucune table, séquence ou fonction qu'ils contiennent (`03` P7, règle 3 de `0001`). Aucun de nos schémas ne figure dans `[api].schemas` de `supabase/config.toml` (B3) ; sur un projet hébergé, l'exposition se vérifie à la main (§10, Lot 0) — l'absence de `USAGE` la rend de toute façon inoffensive |
| **T2.5** | Cloisonnement horizontal explicite : annonceur A ne lit rien d'annonceur B ; créateur A ne lit ni le profil identifié, ni les candidatures, ni les conversations de créateur B. **Rôle pris mais contexte absent** (aucun `set_config`) ⇒ `filtré` ou `refus_droit`, jamais une ligne (P4). Variante `aal1` pour `influx_agent` et `influx_admin` : rien de ce qui est `autorisé` en `aal2` ne l'est. *Hors rôle pris, la forme attendue est un refus : T4.5* |
| **T2.6** | Les colonnes en écriture interdite (`identity_revealed_at`, `origin`, `reference`, les deux pays historisés) sont refusées à tous les rôles applicatifs, au niveau **colonne** et pas seulement table |
| **T2.7** | *Ajouté le 2026-09-26.* **Instantané exact des droits.** Pour chaque rôle de la liste fermée de `03` P7, l'ensemble des privilèges accordés (tables, colonnes, séquences, fonctions, schémas) est **égal** à celui du fichier d'attendus — ni plus, ni moins. En particulier : `TRUNCATE` (qui **ignore la RLS**), `REFERENCES`, `TRIGGER` et `MAINTAIN` (PostgreSQL ≥ 17) ne sont accordés à **aucun** rôle d'exécution ; `influx_audit_writer` n'a que `SELECT` et `INSERT` sur `audit.audit_events` ; `influx_session_resolver` n'a que les `SELECT` de colonnes déclarés et **aucune** écriture ; `EXECUTE` sur `audit.append()` n'est accordé ni à `influx_app` ni aux quatre rôles métier (C(37)) |
| **T2.8** | *Ajouté le 2026-09-26.* **Aucune fonction n'est publiée par défaut.** Aucune fonction de nos schémas n'a `EXECUTE` pour `PUBLIC` — lu avec `aclexplode(coalesce(proacl, acldefault('f', proowner)))`, car un `proacl` nul **vaut** le droit par défaut, qui inclut `PUBLIC`. Et une **création témoin** : dans une transaction annulée, le rôle de migration crée une table, une séquence et une fonction dans chacun de nos schémas ; aucun de `PUBLIC`, `anon`, `authenticated`, `service_role` n'obtient de droit dessus (`ALTER DEFAULT PRIVILEGES`, règles 3 et 4 de `0001`) |

---

### T3 — Inviolabilité du registre et détection d'altération de chaîne

| | |
|---|---|
| **Niveau** | Intégration, en base |
| **Lot** | 0 |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Une mutation réussie sur une table d'audit, **ou** une altération que la vérification ne détecte pas |

**Le cas T3.5 est le plus important de tout ce plan après T1.** Un registre inviolable dont on ne
sait pas prouver l'intégrité ne vaut rien : il faut **casser volontairement la chaîne** dans la base
de test, en tant que propriétaire, et exiger que le vérificateur crie.

```ts
// Illustration — la vérification doit détecter ce que le test vient de casser (T3.5)
await enTantQueRoleDeMigration(async (tx) => {   // DIRECT_DATABASE_URL, une transaction
  await tx`alter table audit.audit_events disable trigger audit_events_no_update_delete`;
  await tx`update audit.audit_events set payload = payload || '{"altered":true}'::jsonb
            where chain_key = 'global' and seq = 7`;
  await tx`alter table audit.audit_events enable trigger audit_events_no_update_delete`;
  const résultat = await verifierChaine(tx, "global");   // dans la même transaction
  expect(résultat.anomalie).toBe("broken_row");
  expect(résultat.status).toBe("broken");
  expect(résultat.broken_at_seq).toBe(7);                // et pas « quelque chose ne va pas »
});                                                      // puis ROLLBACK : la chaîne est intacte
```

**Mode opératoire des altérations (T3.5 à T3.7, T3.11), précisé le 2026-09-26.** Les déclencheurs de
P8 bloquent aussi le propriétaire : l'altération se fait donc **en tant que rôle de migration, dans une
transaction** qui désactive le déclencheur, altère, le réactive, **appelle la vérification sur cette
même transaction**, puis **annule**. Aucune altération n'est validée : les cas restent indépendants de
leur ordre d'exécution. Exigence de testabilité qui en découle : **le vérificateur s'appelle sur une
transaction fournie** (fonction SQL, ou module qui la reçoit en paramètre) ; en production, il tourne
sous `influx_worker` (E-4).

**Deux niveaux de résultat, à ne pas confondre.** Le vérificateur renvoie l'anomalie de chaque ligne
(`broken_row`, `broken_link`, `gap` — `04` §7.2) ; `audit.chain_checks.status` n'admet que `ok`,
`broken` et `gap` (`04` §4). Les tests assertent les deux : `broken_row` et `broken_link` s'inscrivent
`broken`, avec `broken_at_seq` égal au `seq` de la **première** anomalie.

| Cas | Ce qu'il vérifie |
|---|---|
| **T3.1** | `UPDATE`, `DELETE`, `TRUNCATE` sur `audit.audit_events` lèvent `42501` pour **chacun** des rôles d'exécution, un par un (une boucle, pas un rôle représentatif). **J2 :** les trois rôles de connexion sans rôle pris, les quatre rôles métier, `influx_auth`, `influx_worker` ; `influx_audit_writer`, injoignable par `SET ROLE`, est vérifié au catalogue (`has_table_privilege` faux pour les trois). Même boucle sur chaque table marquée `append_only` dans le fichier d'attendus de T2 |
| **T3.2** | Un rôle d'exécution ne peut ni **désactiver les déclencheurs** (`ALTER TABLE … DISABLE TRIGGER`) ni supprimer la table : `42501`. **Et les déclencheurs seuls, sans la couche des droits** : en tant que rôle de migration (qui a les droits), `UPDATE`, `DELETE` et `TRUNCATE` lèvent l'exception de `influx.assert_append_only()` (`04` §7.2) |
| **T3.3** | `INSERT` direct refusé à tous les rôles d'exécution sauf `influx_audit_writer` (`has_table_privilege`, puis tentative) : l'écriture ne passe que par `audit.append(...)`, dont le propriétaire est `influx_audit_writer` (T4.4) |
| **T3.4** | Après N insertions **par `audit.append()`**, la chaîne est continue : `seq` sans trou, `prev_hash` égal au `row_hash` précédent, `payload_hash` **recalculé depuis la forme canonique** et `row_hash` recalculé égaux aux valeurs stockées |
| **T3.5** | **Altération d'un contenu** (`payload` modifié, empreintes stockées inchangées) ⇒ anomalie `broken_row`, statut `broken`, `broken_at_seq` exact. **Ce cas n'est détectable que si le vérificateur recalcule `payload_hash` depuis la forme canonique** : la requête illustrative de `04` §7.2 compare `row_hash` à l'empreinte **stockée** et ne le voit pas (remonté à `expert-database`, §9.5) |
| **T3.6** | **Altération d'un maillon** (`prev_hash` réécrit) ⇒ anomalie `broken_link` sur cette ligne, statut `broken` |
| **T3.7** | **Suppression d'une ligne intermédiaire** en tant que rôle de migration ⇒ anomalie `gap`, statut `gap`, `broken_at_seq` égal au `seq` **manquant** |
| **T3.8** | **Concurrence** : 50 écritures simultanées (50 connexions distinctes) produisent 50 `seq` consécutifs, aucune bifurcation ; la contrainte `unique (chain_key, prev_hash)` n'est jamais violée en fonctionnement normal. *EC-35, point 8 :* 50 connexions `influx_app` (plus la connexion partagée du fichier) sous la limite d'attente de 60 (EC-33) ; un dépassement échoue bruyamment (`too many connections`), jamais en silence. Si `architecte` fixe la limite en dessous de 55, le nombre d'écrivains descend à limite − 5, **jamais sous 20** |
| **T3.9** | Une transaction **annulée** ne laisse **pas** de trou de séquence (c'est l'argument qui justifie le verrou consultatif plutôt qu'une séquence PostgreSQL) |
| **T3.10** | Chaque vérification écrit une ligne dans `audit.chain_checks` avec un `head_row_hash` non nul. Les mêmes interdits de mutation (T3.1, T3.2) s'appliquent, **dès que la table existe**, à `terms_acceptances` et `consent_events` (J2), puis `conversation_access_log`, `messages` (Lot 4), `deal_field_changes` (Lot 5) ; `chain_checks` est proposée en ajout seul (§9.5) |
| **T3.11** | *Ajouté le 2026-09-26.* **Suppression de la ou des dernières lignes** : aucun trou n'apparaît, la requête de `04` §7.2 ne voit rien. La vérification part donc de la dernière ligne de `chain_checks` : si la ligne `to_seq` n'existe plus, ou si son `row_hash` diffère de `head_row_hash`, statut `gap` ou `broken`. *Une réécriture complète de la chaîne après la ligne altérée, empreintes recalculées, reste indétectable en base : seule la publication externe de l'empreinte de tête (I-3, Lot 4) la révèle ; ce test ne le prétend pas* |

---

### T4 — Aucun rôle d'exécution ne porte `BYPASSRLS`

| | |
|---|---|
| **Niveau** | Intégration, en base ; T4.6 et T4.8 en partie unitaires (sans base) |
| **Lot** | 0 (J2) |
| **Déclencheur** | À chaque exécution **et avant chaque déploiement** : T4.1 à T4.4 sont rejoués par la CI sur la base cible, avec la connexion de migration (CI-5), en lecture du catalogue seule. **Et au démarrage de chaque processus** en production (T4.6, point e ; `03` P7, règle 6 de `withUserTransaction`) |
| **Critère d'échec** | Un rôle `influx_%` avec `rolbypassrls` ou `rolsuper` ; un rôle, un attribut, une appartenance ou une propriété hors de la liste fermée de `03` P7 ; une lecture sans rôle pris qui ne lève pas de refus ; un démarrage accepté malgré une variable de base incorrecte |

**Pourquoi ce test précède tous les autres en importance logique.** Si un rôle d'exécution contourne
la RLS, **tous les tests T2 deviennent facultatifs sans qu'aucun ne rougisse**. C'est le seul défaut
de ce plan qui rendrait le reste du plan décoratif. Il est donc exécuté **avant** les tests de RLS, et
un échec de T4.1 interrompt la suite.

**Référence : la liste fermée de `03` §4 P7** (EC-1 et EC-20 tranchés le 2026-09-26), recopiée dans
le fichier d'attendus avec le jalon d'apparition de chaque rôle. **Au J2, douze rôles** :

| Rôle | `LOGIN` | Membre de (seul) | Variable |
|---|---|---|---|
| `influx_app` | oui, `NOINHERIT` | `influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin` | `DATABASE_URL` (`api`) |
| `influx_auth_login` | oui, `NOINHERIT` | `influx_auth` | `AUTH_DATABASE_URL` (`api`) |
| `influx_worker_login` | oui, `NOINHERIT` | `influx_worker` | `WORKER_DATABASE_URL` (`worker`) |
| `influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin`, `influx_auth`, `influx_worker` | non | aucun | — |
| `influx_audit_writer`, `influx_session_resolver`, `influx_identity_definer` | non | aucun ; **aucun membre** | — |

Plus tard, déjà nommés : `influx_ops` et `influx_ops_login` (J4), `influx_intro_owner` (Lot 4),
`influx_privacy` et `influx_privacy_login` (Lot 5). **`influx_service` n'existe pas** et
**`ELEVATED_DATABASE_URL` a disparu**.

```sql
-- Illustration (T4.1) — énumération par motif, jamais par une liste recopiée
select rolname, rolsuper, rolbypassrls
  from pg_roles
 where (rolname like 'influx\_%' or rolname = any ($1::text[]))  -- $1 : utilisateurs des URL
   and (rolsuper or rolbypassrls);
-- Toute ligne renvoyée = CI rouge, et les tests suivants ne sont pas exécutés.
```

| Cas | Ce qu'il vérifie |
|---|---|
| **T4.1** | **Aucun** rôle `influx_%`, et aucun utilisateur d'une variable de base du processus, ne porte `rolsuper` ni `rolbypassrls` — énumération par motif, donc aussi un rôle ajouté hors liste. Exécuté en premier |
| **T4.2** | **Liste fermée et attributs exacts.** L'ensemble des rôles `influx_%` est **égal** à la liste du jalon (J2 : les douze ci-dessus) ; `influx_service` est absent. Pour chacun : `rolcreatedb`, `rolcreaterole`, `rolreplication` faux ; `rolcanlogin` conforme à la liste ; `rolinherit` faux pour les trois rôles de connexion ; `rolconnlimit` différent de `-1` et `rolconfig` portant `statement_timeout` et `idle_in_transaction_session_timeout` (présence vérifiée ; valeurs comparées dès qu'`architecte` les a fixées) |
| **T4.3** | **Appartenances exactes.** L'ensemble **transitif** des appartenances de chaque rôle de connexion est **égal** à sa ligne ; chaque attribution porte `inherit_option = false`, `set_option = true`, `admin_option = false`. Aucun rôle `influx_%` n'est membre de `postgres`, `service_role`, `authenticated`, `anon`, `pg_read_all_data`, `pg_write_all_data` ni d'un rôle `supabase_*`. Les trois propriétaires n'ont **aucun membre** ; seule est tolérée l'attribution implicite au rôle créateur imposée par PostgreSQL ≥ 16 (membre = rôle de migration, `admin_option` vrai, `inherit_option` et `set_option` **faux** — à confirmer par `expert-cybersecurite`, §9.1 C-9). **Refus éprouvés** : depuis chaque rôle de connexion, `SET ROLE` vers `service_role`, `postgres`, `authenticated`, `anon`, chaque propriétaire de fonction, et le rôle élevé d'un **autre** rôle de connexion (`influx_app` → `influx_auth` ou `influx_worker` ; `influx_auth_login` → `influx_worker` ; `influx_worker_login` → `influx_auth` ou un rôle métier) lève `42501` |
| **T4.4** | **Propriété.** Aucun rôle d'exécution (les trois rôles de connexion, les quatre rôles métier, `influx_auth`, `influx_worker`) ne possède d'objet (`pg_class`, `pg_proc`, `pg_type`, `pg_namespace`). Schémas, tables, types et séquences de nos schémas appartiennent au rôle de migration. **Toute fonction `SECURITY DEFINER` de nos schémas** figure dans la liste déclarée avec son propriétaire (J2 : `audit.append` → `influx_audit_writer`, `identity.resolve_session` → `influx_session_resolver`, `identity.grant_role` → `influx_identity_definer`) ; ce propriétaire n'a ni `rolsuper` ni `rolbypassrls` ; son `proconfig` fixe un `search_path` vide ; **aucune** n'appartient au rôle de migration (`03` P7, règle 5). _Conséquence : le déclencheur d'ajout seul est `SECURITY INVOKER` — `04` (§4.1 et §12.1, point 7) remplace déjà l'`audit.deny_mutation()` `security definer` illustrée en `03` P8 par `influx.assert_append_only()` ; T4.4 le garde_ |
| **T4.5** | **Sans rôle pris, un rôle de connexion n'a aucun droit : l'échec attendu est un refus, pas « zéro ligne »** (demande d'`expert-cybersecurite`, 2026-09-26). Pour chacun des trois rôles de connexion, sans `SET LOCAL ROLE` — instruction isolée hors transaction, puis transaction ouverte sans prise de rôle — `select`, `insert`, `update` et `delete` sur **chaque** table de nos schémas lèvent `42501`. **Un résultat « zéro ligne » est un échec** : il prouverait qu'un droit est hérité (`NOINHERIT` ou `INHERIT FALSE` manquant) et que seule une politique filtre. Seule exception, nommée : `influx_app` exécute `identity.resolve_session()` ; `influx_auth_login` et `influx_worker_login` ne l'exécutent pas. **Et le rôle ne survit pas à la transaction** : sur une grappe de taille 1, après le `COMMIT` puis après le `ROLLBACK` d'une transaction qui a pris un rôle, l'instruction suivante voit `current_user` égal au rôle de connexion et est refusée |
| **T4.6** | **Variables de base et refus de démarrage (EC-20).** a) `api` exige `DATABASE_URL` et `AUTH_DATABASE_URL` ; `worker` exige `WORKER_DATABASE_URL` **seule** : sa configuration n'a aucune clé pour `DATABASE_URL` ni `AUTH_DATABASE_URL` et il n'ouvre qu'une grappe. b) L'utilisateur de chaque URL (avant le `.` du multiplexeur ; sans suffixe en pile locale) est **exactement** `influx_app`, `influx_auth_login`, `influx_worker_login` respectivement ; sinon refus — cas essayés : `postgres`, le rôle d'une autre variable, `influx_app_x`, utilisateur vide, casse différente. c) Deux URL d'un même processus avec le même utilisateur ⇒ refus. d) `RAILWAY_ENVIRONMENT_NAME` présent : `api` portant `WORKER_DATABASE_URL`, ou `worker` portant `DATABASE_URL` ou `AUTH_DATABASE_URL` ⇒ refus ; sans cette variable (poste local, `.env.local` partagé), la présence est tolérée mais la variable n'est pas lue. e) À l'ouverture de chaque grappe, `current_user` et l'absence de `rolsuper` / `rolbypassrls` sont lus en base, **sur le rôle de connexion et sur tout rôle qu'il atteint par appartenance** (`pg_auth_members`, récursif ; *ajouté le 2026-09-27, S2 de la revue de fin de J2*) ; tout écart ⇒ refus — fonction de décision testée en unitaire sur toutes ses branches, chemin nominal en intégration. f) Hors hôte de bouclage, TLS avec vérification du certificat et `prepare: false` (`03` P7, règle 1). g) `apps/api/.env.example` porte les trois lignes d'EC-20, dont l'utilisateur satisfait b). h) La chaîne `ELEVATED_DATABASE_URL` n'apparaît nulle part dans `apps/`, `packages/`, `supabase/` ni `.github/` |
| **T4.7** | **Garde d'entrée de transaction** (`03` P7, règle 3). Sur une grappe de taille 1, un `SET ROLE` **de session** est laissé sur la connexion (fuite simulée) ; le `withUserTransaction` suivant constate `current_user <> session_user`, **n'exécute pas** la fonction reçue, annule, détruit la connexion et écrit une ligne `error` sans donnée ; l'appel suivant obtient une connexion neuve. Même cas pour la grappe élevée : *EC-35, point 6 :* non testable tant que l'union U est vide, **exigé dans le commit du J3 qui fait entrer E-1** |
| **T4.8** | **Le nom du rôle pris vient d'une table constante** (`03` P7, règle 4). Unitaire : la table rôle métier → rôle Postgres couvre exactement les quatre rôles métier ; toute autre valeur lue en base (`service`, chaîne vide, valeur piégée contenant `;` ou `"`) ⇒ refus **sans aucune instruction SQL émise** ; `SET LOCAL ROLE` n'apparaît qu'à un seul endroit de `src/db/` (garde T6.6) |

---

### T5 — Journalisation des lectures de conversation (A10)

| | |
|---|---|
| **Niveau** | Intégration (base) + statique (X2) |
| **Lot** | 4 |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Un chemin de lecture des messages accessible à `influx_agent` ou `influx_admin` en dehors de la fonction journalisante |

| Cas | Ce qu'il vérifie |
|---|---|
| **T5.1** | **= contrôle X1.** `has_table_privilege('influx_agent','messaging.messages','SELECT')` est faux, idem `influx_admin`, idem sur `messaging.conversations`. **C'est ce `REVOKE` qui fait la garantie, pas la fonction** |
| **T5.2** | Un appel à `messaging.read_conversation(...)` crée **exactement une** ligne dans `conversation_access_log` — ni zéro, ni une par message |
| **T5.3** | `was_participant` est correct dans les deux cas (agent responsable du fil, agent extérieur) et n'est **jamais** une condition d'accès |
| **T5.4** | Le journal ne contient **aucun contenu de message**, aucun extrait, aucun aperçu |
| **T5.5** | **= contrôle X2.** Contrôle statique : la chaîne `messaging.messages` n'apparaît que dans le `repository.ts` déclaré et dans la liste fermée des fonctions SQL |
| **T5.6** | La fonction refuse : rôle membre, `aal1`, compte suspendu. Une partie suspendue **conserve la lecture et perd l'écriture** (C(23)) |
| **T5.7** | La lecture de `conversation_access_log` par un `admin` est **elle-même journalisée** — sinon le contrôleur échappe au contrôle |

> **Ce que je refuse de mettre dans la CI : le contrôle X3.** Le rapprochement statistique via
> `pg_stat_statements` est un excellent **signal nocturne**, mais il n'est pas déterministe (agrégation
> par requête normalisée, remise à zéro au redémarrage). Un contrôle non déterministe dans une CI
> bloquante produit des échecs qu'on finit par ignorer, et le jour où il a raison, personne ne le
> croit. **X3 est une tâche du worker avec alerte ; X4 est une revue humaine hebdomadaire.** Ni l'un ni
> l'autre n'est un test. À confirmer par `expert-cybersecurite` (§9.1).

---

### T6 — Opérations élevées : la liste fermée est réellement fermée

| | |
|---|---|
| **Niveau** | Statique + intégration |
| **Lot** | 0 |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Un appelant de `withElevatedTransaction` hors liste, ou un motif accepté hors union fermée |

**Trois ensembles, précisés le 2026-09-26 (EC-1, `03` P7).** **P** : la liste de `03` P7 (E-1 à E-5 ;
E-6 seulement une fois signée par `expert-cybersecurite`). **U** : les membres de l'union fermée de
`packages/contracts`. **A** : les opérations passées, **en littéral**, à chaque appel de
`withElevatedTransaction` dans `apps/` et `packages/` (fichiers de test exclus). **Une opération entre
dans U dans le commit qui introduit son premier appelant** — même règle que les variables de `21` J1-D :
E-1 et E-2 au J3, E-3 au J6, E-4 avec la première tâche périodique, E-5 au Lot 5. **Au J2, U et A sont
vides** ; le mécanisme est néanmoins en place et éprouvé.

**Tout contrôle statique est éprouvé sur des fichiers témoins.** Un analyseur qui ne trouve rien sur
un code vide passe toujours, y compris s'il est cassé. T6.1, T6.3, T6.6 et T16.1, T16.2, T16.7
s'exécutent donc aussi sur un dossier de fichiers témoins en infraction (hors de `apps/` et
`packages/`), où chaque infraction attendue **doit** être signalée.

| Cas | Ce qu'il vérifie |
|---|---|
| **T6.1** | **U ⊆ P** et **A = U** : ni plus (dérive), ni moins (une opération déclarée mais jamais appelée est une porte ouverte inutilement). Un appel dont l'opération n'est pas un littéral, ou une référence à `withElevatedTransaction` qui n'est pas un appel direct (alias, réexportation, passage en argument), fait échouer le contrôle : sinon l'ensemble A n'est plus vérifiable |
| **T6.2** | Une opération hors de U, passée par transtypage, est refusée **à l'exécution** : exception levée **avant** toute prise de connexion (aucune instruction SQL émise), ligne `error` sans donnée, aucune ligne d'audit. Testable dès le J2 |
| **T6.3** | **Séparation par processus**, sur le graphe d'imports. Depuis `apps/api/src/main.ts` : aucune référence à E-3, E-4, E-5, ni à `WORKER_DATABASE_URL` ou `PRIVACY_DATABASE_URL`. Depuis `apps/api/src/worker.ts` : aucune référence à E-1, E-2, ni à `DATABASE_URL` ou `AUTH_DATABASE_URL`. E-1 et E-2 ne sont appelées que depuis le module d'authentification. Et chaque opération est liée à sa grappe par une table constante (E-1, E-2 → `AUTH_DATABASE_URL` ; E-3, E-4 → `WORKER_DATABASE_URL` ; E-5 → `PRIVACY_DATABASE_URL`). *Exemptions nommées (EC-35, point 4), par chemin exact :* `apps/api/src/config/schema.ts` (nomme toutes les variables pour refuser celle posée sur le mauvais service, EC-20 ; son refus est prouvé par T4.6 a et d) et `packages/contracts/src/elevated-operations.ts` (déclare P). Ces deux fichiers restent soumis à T6.1 ; toute autre exemption exige l'accord de `testeur` |
| **T6.4** | *À partir du J3 (première élévation).* Chaque transaction élevée **validée** écrit exactement une ligne d'audit portant l'opération (code d'événement lu dans `audit.event_types`, jamais recopié) et le `request_id` ; une transaction élevée annulée n'en laisse aucune. *Volume à trancher avant le J6* : une ligne par tour de file du worker saturerait la chaîne (§9.1, C-7) |
| **T6.5** | *À partir du J3.* Le chemin élevé n'emprunte jamais une connexion du chemin utilisateur : dans E-1, `session_user = influx_auth_login` et `current_user = influx_auth` ; dans `withUserTransaction`, `session_user = influx_app` ; dans E-3, `session_user = influx_worker_login` |
| **T6.6** | *Ajouté le 2026-09-26.* **Aucun état de session** (`03` P7, règles 1, 2 et 4), garde statique sur `apps/api/src/` et `packages/*/src/`, textes SQL compris : interdits `SET ROLE` sans `LOCAL`, `RESET ROLE`, `RESET ALL`, tout `SET` de session (seuls `SET LOCAL` et `SET CONSTRAINTS` sont admis), tout `set_config` dont le troisième argument n'est pas le littéral `true` (*étendu le 2026-09-27, S1* : `false`, une valeur liée ou un argument absent), `LISTEN` / `UNLISTEN`, `pg_advisory_lock` / `pg_try_advisory_lock` / `pg_advisory_unlock` (seules les variantes `_xact_` sont admises), `rejectUnauthorized: false`. `SET LOCAL ROLE` n'apparaît qu'à un seul endroit de **tout `apps/api/src/` et `packages/*/src/`** (`apps/api/src/db/roles.ts`), avec une seule exemption nommée : le harnais `packages/test-kit/src/db/harness.ts` (*étendu le 2026-09-27, S1 de la revue de fin de J2* ; auparavant limité à `src/db/`) ; `packages/test-kit` est soumis à la même garde |

---

### T7 — Le passe-plat

| | |
|---|---|
| **Niveau** | Unitaire contre un **faux serveur HTTP local** (`node:http`) dès le J1 ; intégration (HTTP, front + API doublée) au J9 |
| **Lot** | **0** pour les conditions PP en unitaire (J1, `21` §4 J1-C et J1-H), T7.8 à T7.12 ; **1** pour T7 complet en intégration (J9) |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Une requête sortante dont la cible est influencée par l'entrée utilisateur, ou une réponse authentifiée servie à un autre utilisateur |

| Cas | Ce qu'il vérifie |
|---|---|
| **T7.1** | **Chemin validé sur sa forme brute, sans aucun décodage (PP-2).** En table de cas, chacun refusé en `404 not_found` **sans appel à `apps/api`** : traversée (`/api/v1/../admin`), `//`, `\`, `:` et `@` dans le chemin, URL absolue et autorité injectée (`https://api.internal@evil.tld/…`), chemin hors de `^/v1/[A-Za-z0-9/_\-]{0,200}$` (autre version, extension, plus de 200 caractères) ; et **tout chemin contenant un `%`**, quel que soit ce qu'il donnerait une fois décodé : traversée (`%2e%2e%2f`), autorité (`api.internal%40evil.tld`), double encodage (`%252e`), séquence invalide (`%E0%A4%A`), et même un chemin autorisé (`%73tatus`, `bo%2Fx`). Contre-test : un chemin autorisé est relayé **inchangé**. *Reformulé le 2026-09-25 (EC-28 de `21`) : remplace « refusés après décodage », contraire à PP-2 révisé (R1)* |
| **T7.2** | **En-têtes relayés (PP-5, PP-6, PP-7).** Seuls les en-têtes de la liste blanche de PP-5 sont relayés ; `x-middleware-subrequest`, `x-forwarded-host` et tout en-tête `x-*` non listé sont **supprimés**. **`x-forwarded-for` n'est jamais lu ni relayé**, qu'il soit seul ou accompagné de `x-real-ip`, et n'influe jamais sur l'adresse transmise. **`x-real-ip` est retransmis sous `x-real-ip` seulement s'il a la forme `^[0-9A-Fa-f:.]{2,45}$`** (IPv4, IPv6, IPv4 mappée) ; absent ou de forme invalide (liste d'adresses, nom d'hôte, caractère étranger, longueur hors bornes), il n'est **pas transmis**, et le passe-plat ne lui substitue aucune autre valeur. Un `x-request-id` fourni par le client n'est jamais utilisé comme identifiant d'audit : le passe-plat en génère un et conserve celui du client à part, sous `client-request-id`. Qu'un `x-real-ip` forgé soit écrasé par l'entrée de Railway ne se vérifie pas en unitaire : constat sur `staging` au J4 (T7.12). *Reformulé le 2026-09-25 (EC-28 de `21`) : remplace « `x-forwarded-for` et `x-real-ip` sont réécrits », contraire à PP-6 révisé (A5)* |
| **T7.3** | Corps > 1 Mo ⇒ 413 ; délai > 10 s ⇒ coupure |
| **T7.4** | Une redirection renvoyée par `apps/api` **n'est pas suivie** ; elle est relayée telle quelle |
| **T7.5** | `Set-Cookie` multiple relayé **verbatim** ; un nom ne commençant pas par `__Host-` fait rejeter la réponse |
| **T7.6** | `Cache-Control: no-store` présent sur **toutes** les réponses du passe-plat |
| **T7.7** | **Le test qui compte** : deux utilisateurs authentifiés différents appelant **la même URL** reçoivent des réponses **différentes**. C'est le scénario catastrophe — instantanément massif, indétectable sans ce test |
| **T7.8** | **Empreinte du fichier du passe-plat** (PP-12, I-8) : toute modification fait échouer la CI tant que l'empreinte attendue n'est pas mise à jour dans le même commit. C'est la contrepartie de l'absence de Pull Request |
| **T7.9** | `apps/api` refuse toute requête dépourvue de l'en-tête interne `x-influx-internal` (PP-8) |
| **T7.10** | **`matcher` du `proxy.ts` de `apps/web`, vérifié sur le manifeste compilé.** Après `next build`, le motif lu dans le manifeste du proxy produit par Next.js — et non le texte source du `matcher` — ne correspond à **aucun** chemin du passe-plat (`/api/v1/status`, `/api/v1/bo/…`) : ils ne sont jamais redirigés vers `/fr/api/…` (J1-C, point 3). Contre-test : `/` et `/en` correspondent. La route de santé publique d'EC-22 s'y ajoute au J9. Exécuté avec `test:artifacts`, après la construction |
| **T7.11** | **`x-request-id` non repris sans secret.** `apps/api` ne reprend l'identifiant relayé qu'**après** validation du secret interne. Sans secret, avec un secret inconnu, ou sur `/health`, la réponse et sa ligne de journal portent un identifiant **généré**, jamais celui reçu, **même au format UUID** : sinon quiconque atteint l'API sans secret choisit l'identifiant de sa ligne de journal. *Écart constaté à la vérification de fin de J1 (l'identifiant est choisi avant le contrôle du secret) : correction et test au plus tard au J3* |
| **T7.12** | **Adresse du client (PP-6, EC-21).** `clientAddress()` ne retient jamais une valeur fournie par le client : un `x-forwarded-for` ou un `x-real-ip` forgé, seul ou mêlé à l'entrée ajoutée par l'entrée de Railway, ne change pas le résultat ; `apps/api` ne lit l'adresse relayée qu'après validation du secret interne. **Unitaire au J3** (table d'en-têtes forgés) ; **constat sur `staging` au J4** avec un en-tête forgé, consigné — non automatisable en CI, l'entrée de Railway ne se reproduit pas en local. La limitation par IP (T8.4, T15.4) repose sur ce cas |

---

### T8 — Authentification

| | |
|---|---|
| **Niveau** | Intégration, avec **horloge injectée** (aucun `sleep` dans un test) |
| **Lot** | 1 ; T8.7, T8.12 et T8.13 dès le Lot 0 (J3, sessions) |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Toute condition A-1 à A-12 ou B-1 à B-8 non tenue |

| Cas | Ce qu'il vérifie |
|---|---|
| **T8.1** | **Un seul code valide à la fois** : une nouvelle demande invalide immédiatement le précédent (A-1) |
| **T8.2** | Expiration à 10 minutes, horloge avancée par injection |
| **T8.3** | 5 tentatives ⇒ le **code** est invalidé, **jamais le compte** (A-4) |
| **T8.4** | Limitation à trois niveaux : par adresse (3 / 15 min, 10 / h), par IP (20 / h), et surveillance globale du taux d'échec. Le **tir groupé** est le scénario testé : 200 adresses, un essai chacune, depuis une même IP ⇒ bloqué |
| **T8.5** | **Anti-énumération.** Contenu de réponse **strictement identique** pour une adresse connue et inconnue (déterministe, bloquant). Pour le **temps de réponse** : je refuse un test au chronomètre, instable par nature. Il est remplacé par un test du **chemin d'exécution** — le gestionnaire exécute le même nombre d'opérations coûteuses dans les deux cas, vérifié par un compteur instrumenté. Le chronomètre reste, mais comme **mesure nocturne indicative**, pas comme test bloquant |
| **T8.6** | Un code consommé n'est pas réutilisable |
| **T8.7** | **Session révoquée immédiatement** à la suspension du compte et au changement de rôle (B4 / A-9) |
| **T8.8** | Toute route du backoffice sans `aal2` ⇒ 403, y compris si `apps/api` l'avait autorisée par erreur (la politique RLS est la troisième barrière) |
| **T8.9** | Changement d'adresse e-mail sans **double confirmation** (ancienne **et** nouvelle) ⇒ refus (A-11, C(2)) |
| **T8.10** | TOTP **anti-rejeu** : un code consommé est refusé dans sa fenêtre (B-3) |
| **T8.11** | Un code de secours est à **usage unique**, sa consommation alerte tous les admins, sa valeur n'est jamais journalisée (MFA-3, MFA-4) |
| **T8.12** | Le cookie de session porte un **identifiant opaque** : il ne se décode pas en JWT, il n'a pas trois segments base64, et sa révocation en base rend la requête suivante non authentifiée |
| **T8.13** | **Contrôle d'origine (CSRF), J3.** Toute requête `POST`, `PATCH`, `PUT` ou `DELETE` dont `Sec-Fetch-Site` n'est pas `same-origin` **et** dont `Origin` n'est pas l'origine attendue de la surface ⇒ `403` en enveloppe, **avant tout effet**. Table de cas : `cross-site` ; **`same-site`** (le backoffice est un sous-domaine du même site : refusé) ; `none` ; les deux en-têtes absents ; `Origin: null` ; origine de l'autre surface. Contre-tests : `same-origin` accepté ; `GET` non concerné. Exécuté **au travers du passe-plat**, pas seulement par `inject()`, pour prouver que les deux en-têtes atteignent le contrôle (liste blanche PP-5) |

---

### T9 — Storage

| | |
|---|---|
| **Niveau** | Intégration (Storage + API) |
| **Lot** | 2 |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Un compartiment public, une pièce de vérification atteignable par un annonceur, ou une image publiée avec ses métadonnées |

| Cas | Ce qu'il vérifie |
|---|---|
| **T9.1** | `storage.buckets.public = false` pour **tous** les compartiments, sans exception |
| **T9.2** | URL signée expirée ⇒ refus ; durée émise ≤ 5 min. *Au L2B (D80) : aucune réponse du logo ne porte d'hôte Supabase ni de jeton. Au L2E (D82) : aucune URL signée n'est émise pour les pièces de vérification, aucune réponse ne porte d'hôte Supabase ni de jeton ; le cas devient « aucune URL émise »* |
| **T9.3** | Clé d'objet avec traversée (`../`) ⇒ refus |
| **T9.4** | Fichier dont les **octets d'en-tête** contredisent le type déclaré ⇒ rejet ; PDF refusé (E1-9) |
| **T9.5** | **EXIF absent après traitement** : image de test portant une géolocalisation connue ⇒ après ré-encodage, la donnée a disparu. Le test lit les octets, il ne fait pas confiance à un booléen |
| **T9.6** | **Une pièce de vérification n'est atteignable par aucune route ni aucun schéma du rôle annonceur, y compris en devinant un identifiant** et y compris après révélation d'identité (C(13)). Ce cas est bloquant à lui seul. *Précisé au L2E (EC-L2E-18) : l'annonceur n'a aucun droit sur le schéma `verification`, `USAGE` compris, ni sur `storage` ; toute fonction qu'il exécute, tous schémas, ne nomme ni `verification.evidence_files` ni `storage.` (`prosrc`, corps SQL standard, `pg_depend`) ; les propriétaires atteints de proche en proche n'ont aucun droit sur la pièce ni sur Storage ; une pièce réelle portée dans chaque route donne la même réponse qu'un identifiant inconnu ; témoins rouges et mutation (`USAGE` accordé) vus rouges* |
| **T9.7** | Toute émission d'URL signée est journalisée *(au L2B, D80 : aucune URL signée n'est émise)* ; la lecture d'une pièce de vérification passe par `apps/api` et non par une URL signée (E1-7) *(au L2E : aucune réponse ne porte d'hôte Supabase ni de jeton, et chaque ouverture écrit `verification.evidence_viewed` (agent, demande, pièce) dans la transaction qui rend la clé)* |
| **T9.8** | Quotas par compte (nombre et volume par jour) appliqués côté serveur |
| **T9.9** | Le chemin d'objet est calculé par le serveur et **ne contient jamais le nom de fichier d'origine** |
| **T9.10** | Contrainte de base : un visuel de portfolio dont les métadonnées n'ont pas été retirées **ne peut pas** passer en `approved` ; un remplacement de fichier repasse la modération à `pending` |

---

### T10 — En-têtes et politique de sécurité de contenu

| | |
|---|---|
| **Niveau** | Intégration (HTTP), **en mode production** |
| **Lot** | 1 |
| **Déclencheur** | À chaque exécution **et avant déploiement** |
| **Critère d'échec** | Un en-tête manquant sur une seule réponse, erreurs et redirections comprises |

| Cas | Ce qu'il vérifie |
|---|---|
| **T10.1** | Jeu d'en-têtes exact de `apps/web` (valeurs du §6.5 du document `03`) |
| **T10.2** | Jeu d'en-têtes exact de `apps/backoffice`, plus strict, `img-src 'self' blob:` sans hôte Supabase |
| **T10.3** | Aucun `'unsafe-inline'` dans `script-src` ; toléré dans `style-src` uniquement s'il est accompagné d'une note écrite dans le code |
| **T10.4** | `X-Robots-Tag: noindex, nofollow, noarchive` sur **toutes** les réponses du backoffice : pages, erreurs 404 et 500, redirections, réponses d'API. C'est l'en-tête qu'on oublie sur la page d'erreur |
| **T10.5** | Cookies : noms `__Host-`, `Secure`, `HttpOnly`, `Path=/`, sans `Domain`, `SameSite=Lax` côté membres et `Strict` côté backoffice |
| **T10.6** | La **CSP remplace la garde G2** levée : `default-src 'self'` et `connect-src` explicite, vérifiés à l'exécution (§4) |

---

### T11 — Secrets

| Cas | Ce qu'il vérifie |
|---|---|
| **T11.1** | Analyse des artefacts de construction de `apps/web` et `apps/backoffice` : aucune occurrence de `SUPABASE_SECRET_KEY`, `BREVO_API_KEY`, `APOLLO_API_KEY`, `SESSION_COOKIE_SECRET` |
| **T11.2** | Aucune chaîne ressemblant à un JWT dans un artefact de front |
| **T11.3** | Analyse de secrets sur le dépôt **et son historique** |
| **T11.4** | `.env*` ignoré, `.env.example` présent et à jour (toute variable requise par la validation de démarrage y figure) |
| **T11.5** | La validation de configuration au démarrage **fait échouer le démarrage** si une variable requise manque — testé, pas supposé |

*Niveau : statique + intégration. Lot 0. À chaque exécution et avant déploiement.*

---

### T12 — Dépendances

| Cas | Ce qu'il vérifie |
|---|---|
| **T12.1** | Échec de la CI sur toute vulnérabilité **critique ou élevée** |
| **T12.2** | **Exécution planifiée hebdomadaire**, indépendante des commits |
| **T12.3** | Les dérogations vivent dans un fichier dédié et portent chacune **une date d'expiration** |
| **T12.4** | Une dérogation expirée **fait échouer la CI**. Une dérogation sans échéance est un mensonge différé |

*Niveau : outillage. Lot 0. À chaque exécution + hebdomadaire.*

---

### T13 — Messages d'erreur et journaux

| Cas | Ce qu'il vérifie |
|---|---|
| **T13.1** | Aucune réponse 4xx ou 5xx ne contient de trace d'exécution |
| **T13.2** | Aucun fragment SQL, aucun nom de table, aucun nom de contrainte |
| **T13.3** | Aucun nom d'hôte interne, aucune version de composant |
| **T13.4** | La réponse porte exactement `code`, un message traduisible et `requestId` |
| **T13.5** | Le `requestId` de la réponse se retrouve dans les journaux serveur — sinon il ne sert à rien lors d'un incident |
| **T13.6** | **Masquage des journaux (`02` §20.8).** Une fausse adresse e-mail, un faux code à 6 chiffres et un faux jeton, placés (a) dans une erreur **et dans sa `cause`**, (b) dans un objet imbriqué **à trois niveaux** passé au journal, n'apparaissent **nulle part** dans le flux de journal capturé — ni en clair, ni dans la pile. Complète le test du J1 (aucune valeur de cookie, d'`authorization`, de `x-influx-internal`, ni d'URL brute : modèle de route seulement). Étendu au J4 à la table des occurrences du schéma `ops`, nettoyée par la même fonction |
| **T13.7** | **Unicité des clés dans chaque ligne de journal.** Chaque ligne du flux capturé est un objet JSON **sans clé dupliquée**, vérifié sur le **texte brut** (un `JSON.parse` garde silencieusement la dernière valeur). Parcours : requête réussie, `4xx`, `500`, ligne du worker. Une clé en double laisse une valeur non masquée, ou un `requestId` choisi, l'emporter sur la valeur légitime selon l'outil qui lit |

*Niveau : intégration, sur le flux de journal capturé pour T13.5 à T13.7. Lot 0 (J1) pour
l'enveloppe `404` / `500` et T13.5 à T13.7 ; Lot 1 pour le reste. À chaque exécution.*

---

### T14 — Références directes non contrôlées (IDOR)

| Cas | Ce qu'il vérifie |
|---|---|
| **T14.1** | Pour chaque type d'objet exposé, un utilisateur de chaque rôle tente de **lire** un objet d'autrui en changeant l'identifiant ⇒ refus |
| **T14.2** | Idem en **modification** |
| **T14.3** | **Le code de réponse est identique** à celui d'un objet inexistant : ne pas divulguer l'existence d'une ressource par l'écart entre 403 et 404. *Précisé à la clôture de L2D (L2DT-4, EC-L2D-10-1) : un corps refusé par le schéma répond 400 avant la session, pour tout rôle et toute route ; « code identique à l'inconnu » vaut pour l'objet visé, que le schéma ne lit pas (T1 : rien ne sort, seule l'existence de la route se devine).* |
| **T14.4** | Le corps de la réponse est identique lui aussi (même `code`, même message) |
| **T14.5** | Cas particulier C(18) : un créateur interrogeant l'identifiant d'une demande de contact **refusée** obtient la même réponse que pour une demande inexistante. Il ne doit jamais apprendre qu'une marque s'est intéressée à lui |

*Niveau : intégration. Lots 2 à 5. À chaque exécution.*

---

### T15 — Limitation de débit

| Cas | Ce qu'il vérifie |
|---|---|
| **T15.1** | 429 effectif sur la connexion et l'inscription |
| **T15.2** | 429 effectif sur la recherche et le détail de profil (routes d'exfiltration de l'annuaire) |
| **T15.3** | La limite est appliquée dans `apps/api`, **jamais dans le front** : testée par un appel direct à l'API qui ne passe pas par le passe-plat |
| **T15.4** | La limite porte sur **le compte et sur l'IP**, indépendamment |
| **T15.5** | Le dépassement est journalisé avec le compte concerné (matière de l'alerte I-9 sur l'exfiltration progressive) |

*Niveau : intégration. Lot 1. À chaque exécution.*

---

### T16 — Aucun calcul de commission

| | |
|---|---|
| **Niveau** | Statique + intégration (base) |
| **Lot** | 0 |
| **Déclencheur** | À chaque exécution |
| **Critère d'échec** | Toute multiplication d'un montant par une constante dans `apps/` ou `packages/`, ou tout droit d'écriture sur `billing.commission_rates` |

**Définitions de l'analyse statique, précisées le 2026-09-26** (pour que T16.1 et T16.2 se codent
sans supposer ; soumises à `expert-cybersecurite`, §9.1 C-3) :

- **Périmètre** : fichiers `.ts`, `.tsx`, `.mts`, `.js`, `.mjs` de `apps/` et `packages/` (tests
  compris ; `node_modules`, `.next` et sorties de construction exclus), plus `supabase/migrations/`
  et `supabase/seed/`.
- **Mots d'un identifiant** : découpage sur la casse `camelCase` / `PascalCase`, `_`, `-` et les
  chiffres ; comparaison **par mot entier**, sans tenir compte de la casse.
- **Identifiant monétaire** : un mot parmi `amount`, `amounts`, `montant`, `commission`,
  `commissions`, `minor`, `net`, `fee`, `fees`. **Identifiant de taux** : `rate`, `rates`, `taux`,
  `percent`, `percentage`, `pct`, `bps` — sauf `rate` suivi de `limit` (`rateLimit`, `rate_limit`).
- **Opérande** : l'expression de part et d'autre de `*`, `/`, `**`, `*=`, `/=`, après retrait des
  parenthèses, des signes unaires et des appels `Number()`, `BigInt()`, `Math.round|floor|ceil|trunc()` ;
  pour un accès membre, le dernier segment. En SQL, le jeton adjacent à l'opérateur, hors commentaires,
  `select *`, `count(*)` et `alias.*`.

| Cas | Ce qu'il vérifie |
|---|---|
| **T16.1** | Analyse statique : aucun `*`, `/`, `**`, `*=`, `/=` dont un opérande est un identifiant **monétaire ou de taux** et l'autre un **littéral numérique** (`100n` compris), une constante `SCREAMING_SNAKE_CASE`, un identifiant monétaire ou un identifiant de taux. `amount * rate` est donc refusé même si le taux est lu en base : c'est précisément le calcul interdit |
| **T16.2** | Aucune littérale décimale `0.35`, `0.2`, `0.20`, `0.15`, `0.65`, ni chaîne portant `35 %`, `20 %`, `15 %`, `65 %` (avec ou sans espace), **dans la même fonction** (en SQL : la même instruction) qu'un identifiant monétaire ou de taux. Les entiers nus (`15`, `20`, `35`) ne relèvent que de T16.1 : les interdire à la seule proximité d'un montant signalerait chaque `limit: 20` d'une liste d'affaires |
| **T16.3** | `billing.commission_rates` est **vide** après `supabase db reset` (migrations **et** seed) ; aucun fichier de `supabase/seed/` ni du jeu de données de T2 ne la cite |
| **T16.4** | Aucun droit d'écriture sur `billing.commission_rates` : `has_table_privilege` faux pour `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` pour **chaque** rôle de la liste fermée de `03` P7 (J2 : les douze de T4) **et** pour `PUBLIC`, `anon`, `authenticated`, `service_role` ; une insertion tentée par chaque rôle joignable (les trois rôles de connexion sans rôle pris, les quatre rôles métier, `influx_auth`, `influx_worker`) lève `42501`. *(L'ancienne mention d'un rôle « `service` » ne désignait aucun rôle Postgres : elle est remplacée par cette liste.)* |
| **T16.5** | Aucun montant stocké en **flottant** : aucune colonne de nos schémas n'est de type `real`, `double precision` ou `money` ; toute colonne dont un mot est `amount` ou `montant` est `bigint` (plus petite unité) et sa table porte une colonne de devise (`currency`, ou `<préfixe>_currency` comme `product_value_currency`, conventions de `04` §2) *(seconde condition codée le 2026-09-27, Q3, et éprouvée sur des tables témoins créées puis annulées)*. *Le transport (schémas de `packages/contracts`) est vérifié à partir du Lot 5, quand le premier montant y entre ; sa forme est à fixer par `architecte`* |
| **T16.6** | **Exemption nommée (2026-09-19).** La seule multiplication de montant autorisée est la fonction unique de conversion d'unité monétaire de `packages/domain` (`2 000,00 EUR` ↔ `200000`), dont le facteur est lu dans `reference.currencies.minor_unit`. L'analyse statique de T16.1 **exempte cette fonction et elle seule**, par annotation nominative ; toute autre multiplication échoue. **Au J2, cette fonction n'existe pas** : aucune annotation n'est admise, et le texte de l'annotation est fixé par `expert-cybersecurite` avant l'entrée de la fonction (`03` §8) |
| **T16.7** | **L'exemption ne s'étend pas.** Une seconde fonction annotée comme exemptée, ou une annotation posée ailleurs que sur la fonction de conversion, fait échouer la CI ; le facteur ne peut jamais être un littéral (test sur le corps de la fonction) |

---

### T17 — Garde-fou `staging`

> **D70 (2026-10-18), matrice par environnement** (`apps/api/tests/config.test.ts`, commit 1 de
> `archives/jalons/d70-plan.md`). `INFLUX_ENV` vaut `development` (pile locale, CI, tests : verrous 2 et 3,
> doublure), `staging` ou `production`. Les deux dernières forment « l'environnement déployé »
> (`isDeployedEnvironment`, un seul prédicat) : `staging` refuse **exactement** ce que refuse la
> production, et les cas ci-dessous qui disent « hors production » s'entendent « hors environnement
> déployé » (`development`). `skipped_non_production` n'est atteignable qu'en `development`.
>
> | Cas | `development` | `staging` et `production` (même cas, mêmes refus) |
> |---|---|---|
> | `BREVO_MODE` | `disabled` par défaut, `redirect` avec `BREVO_TEST_RECIPIENTS`, `live` accepté vers la doublure | `live` exigé : `disabled`, absent, `redirect` ⇒ refus |
> | `BREVO_TEST_RECIPIENTS`, `NON_PRODUCTION_RECIPIENT_ALLOWLIST` | acceptées (verrous 2 et 3) | **refusées**, jamais ignorées |
> | `SYNC_MODE` | `dry_run` par défaut ; `live` exige la liste blanche | `live` exigé, y compris variable absente (T17.5) |
> | `BREVO_API_BASE_URL`, origines publiques, `SUPABASE_URL` | doublure locale et `http` acceptées | URL officielle Brevo et origines `https` exigées |
> | Secrets du webhook, `PRIVACY_DATABASE_URL`, paire de purge GoTrue | facultatifs | exigés |
> | `INFLUX_ENV=development` sur Railway | refusé (un service déployé ne se relâche pas par une variable) | — |
>
> Tests : `describe.each` des deux environnements déployés (config complète acceptée, un cas par
> variable retirée ou ajoutée), comparaison `staging` = `production` sur les mêmes cas, démarrage
> refusé au niveau du processus pour les deux (T17.5, T17.10), et une garde (`16` RG148) vérifiant
> qu'aucun script `test`, `test:db` ou e2e ne charge `.env.local`.

**Deux moitiés.** Les **refus de démarrage** (T17.5 à T17.10) sont en place depuis le J1 (`21` §4,
J1-D point 3 ; `apps/api/tests/config.test.ts`). Les **verrous d'exécution** (T17.1 à T17.4) arrivent
avec la synchronisation, au Lot 1. La seconde condition de `16` RG116 (trois sous-domaines
authentifiés) exige un appel à Brevo, doublé en test : elle entre au J9.

| Cas | Ce qu'il vérifie |
|---|---|
| **T17.1** | **Verrou 1** — aucune clé de production hors production ; en `development`, pas de clé Apollo ⇒ `skipped_no_credentials` (en environnement déployé, D67 : `credentials_missing`, `TM1.15`) |
| **T17.2** | **Verrou 2 (`development`)** — `SYNC_MODE=dry_run` : aucun appel sortant, ligne marquée `succeeded` avec `dry_run: true`, contenu journalisé. Refusé en `staging` et en `production` |
| **T17.3** | **Verrou 3 (`development`)** — liste blanche de destinataires évaluée **au connecteur, après tout le mappage**, en condition **positive** ; toute adresse hors liste ⇒ `skipped_non_production`. Inatteignable en `staging` et en `production` (filtre non restreint, liste refusée) |
| **T17.4** | **Verrou 4 (B9)** — aucune donnée de production dans `staging` : le jeu de données provient exclusivement de `supabase/seed` et de `db:staging-demo-accounts`, et un contrôle échoue si une adresse ne se termine pas par un domaine de test réservé (hors adresses de testeurs internes posées par l'agent) |
| **T17.5** | Symétrie : le worker **refuse de démarrer** si `INFLUX_ENV` vaut `staging` ou `production` et `SYNC_MODE=dry_run`, **y compris quand `SYNC_MODE` est absent** (la valeur par défaut `dry_run` ne passe pas en environnement déployé) |
| **T17.6** | **Mode Brevo (`api` et `worker`, `16` RG116).** En `staging` comme en `production`, toute autre valeur que `live` (`disabled`, `redirect`, variable absente) ⇒ refus ; `BREVO_TEST_RECIPIENTS` présente ⇒ refus. En `development` : `redirect` sans `BREVO_TEST_RECIPIENTS` ⇒ refus. Contre-tests : `live` accepté en `staging` et en `production` ; `disabled` par défaut en `development` |
| **T17.7** | **Synchronisation (`worker`).** En `development`, `SYNC_MODE=live` avec `NON_PRODUCTION_RECIPIENT_ALLOWLIST` vide ⇒ refus (contre-test : accepté avec une liste de domaines). En `staging` et `production`, la liste présente ⇒ refus |
| **T17.8** | **Secret interne par front (`api`, J1-G) et environnement.** Secret absent, de moins de **32 octets** (comptés en octets, pas en caractères), ou **identique pour `web` et `backoffice`** ⇒ refus. `INFLUX_ENV` absent ou hors `development` / `staging` / `production` ⇒ refus |
| **T17.9** | Le refus **nomme la variable et la règle, jamais la valeur** : un secret trop court ou dupliqué n'apparaît ni dans le message d'erreur, ni sur la sortie du processus |
| **T17.10** | **Au niveau du processus** : les vrais points d'entrée (`node src/main.ts`, `node src/worker.ts`) sortent avec un **code non nul avant d'écouter** sur un port ou d'entamer leur boucle — au moins un cas par processus. Un refus vérifié seulement sur la fonction de chargement ne prouve pas que le service ne démarre pas |

*Niveau : unitaire (schémas de configuration) et processus pour T17.5 à T17.10, Lot 0 (J1) ;
intégration + configuration pour T17.1 à T17.4, Lot 1. À chaque exécution et avant déploiement.*

---

### 3.1 Récapitulatif des contrôles X1 à X4

| # | Contrôle | Traitement retenu |
|---|---|---|
| **X1** | Privilèges de lecture des messages | **Test de CI = T5.1.** C'est la garantie dure |
| **X2** | Unicité du chemin applicatif | **Test de CI = T5.5** |
| **X3** | Rapprochement statistique nocturne | **Pas un test.** Tâche du worker, alerte au-delà d'un écart. Non déterministe : exclu de la CI (§9.1) |
| **X4** | Revue humaine hebdomadaire | **Pas un test.** Écran de backoffice + discipline d'équipe. Inscrit dans la définition du « prêt à livrer » du Lot 5 comme vérification non automatisable |

---

## 4. Les tests métier, en complément des 17

Les 17 tests de `expert-cybersecurite` couvrent la sécurité et l'anonymisation. Ils ne couvrent **pas**
le métier : la file, les leads, les montants, les transitions. Douze familles s'y ajoutent.

| # | Famille | Niveau | Lot | Cas | Ce qu'elle protège |
|---|---|---|---|---|---|
| **TM1** | **Pipeline de leads et consentement** | Intégration, doublures | 1 | 16 *(10 + 6 le 2026-10-17, D67)* | L'indicateur n° 5, et le veto RGPD |
| **TM2** | **Révélation d'identité atomique** | Intégration, base | 4 | 7 | La preuve d'intermédiation |
| **TM3** | **File de validation, verrou et SLA** | Intégration | 4 | 6 | Le premier risque produit (D39) |
| **TM4** | **Transitions d'état de l'affaire** | Unitaire + base | 5 | 8 | Le chiffre d'affaires |
| **TM5** | **Transitions de campagne et cycle du badge** | Unitaire + base | 2-3 | 6 | La qualité de l'offre |
| **TM6** | **Saisie et historisation des montants** | Intégration, base | 5 | 8 | Le chiffre d'affaires |
| **TM7** | **Détection de coordonnées (corpus)** | Unitaire | 4 | 4 | Le signal d'alerte (§6) |
| **TM8** | **Envoi d'e-mails depuis le backoffice** | Intégration | 5 | 6 | A4 / D35, veto RGPD |
| **TM9** | **Demandes RGPD, suppression, propagation** | Intégration | 5 | 5 | Les droits des personnes |
| **TM10** | **Inscription : validations pures** | Unitaire | 1 | 5 | La première conversion |
| **TM11** | **Anonymisation au niveau des types et des schémas de réponse** | Statique + intégration | 0-2 | 4 | Défense n° 2 d'A2 |
| **TM12** | **Recherche : k-anonymat, pagination, export** | Intégration | 3 | 6 | L'annuaire de créateurs |

### TM1 — Pipeline de leads et consentement (16 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM1.1 | **Un échec Brevo ne fait jamais échouer une inscription** : la doublure renvoie 500, le compte est créé, l'événement reste `pending` |
| TM1.2 | Idem pour Apollo, et pour les deux simultanément |
| TM1.3 | **Rejeu idempotent** : rejouer deux fois ne crée pas deux contacts (`unique (destination, idempotency_key)`), y compris si le backoffice le demande deux fois |
| TM1.4 | **Aucune synchronisation sans consentement**, revérifié **au moment de la consommation** : consentement retiré entre l'émission et le traitement ⇒ statut `skipped` explicite, distinct d'une erreur |
| TM1.5 | Une désinscription revenue de Brevo écrit un `identity.consent_events` **et** pose `unsubscribed_at` ; elle ne crée pas une troisième source de vérité |
| TM1.6 | L'**interrupteur par catégorie de profil** (A7 / R-8) coupe effectivement Apollo pour une catégorie, sans redéploiement |
| TM1.7 | Les événements d'un même `subject_key` sont traités **dans l'ordre** |
| TM1.8 | Le quota ou le 429 d'un tiers met en attente avec `available_at` reporté, **sans perdre le lead** ; `attempts ≤ 10` puis `failed` avec cause en clair |
| TM1.9 | La charge utile d'un événement ne contient **que des identifiants** (C(33)) : aucun e-mail, aucun nom |
| TM1.10 | L'arrêt du worker en cours de lot (`SIGTERM`) ne perd aucun événement : il reste `pending` |
| TM1.11 | *(D67, 2026-10-17)* **Configuration manquante = échec, jamais « ignoré »** : liste Brevo d'un rôle, modèle de bienvenue, réglage Apollo illisible ⇒ ligne `failed` avec le code de `05` RG160, nature `incident`, aucune tentative programmée, comptée dans les échecs non traités et non dans les cas normaux, AL25 levée ; un `consent.revoked` du même compte passe quand même (`05` CA82, CA84) |
| TM1.12 | *(D67)* **Rattrapage automatique** : le réglage corrigé (y compris par écriture SQL directe), les lignes en échec de configuration repartent en moins de 15 min avec la **même clé d'idempotence**, un rejeu système `configuration_restored` est journalisé, aucun second e-mail de bienvenue ; le rejeu manuel unitaire et en lot reste possible ; une ligne `no_consent` reste non rejouable ; *(architecte, 2026-10-17)* une correction faite **pendant** la tentative qui échoue est rattrapée (comparaison au début de la tentative) ; une modification d'une autre clé ne remet rien en file (`05` CA83, CA60, RG161) |
| TM1.13 | *(D67)* **Refus de démarrage en production, au niveau du processus** (comme T17.10) : chacun des réglages de `05` RG162 à `NULL` ou illisible ⇒ `node src/worker.ts` sort avec un code non nul avant sa première boucle, message qui nomme la clé sans valeur (T17.9) ; réglages Apollo contrôlés **seulement** si `APOLLO_API_KEY` est présente ; liste de pays vide acceptée ; aucun modèle Brevo contrôlé (D69). *Contre-test* : même configuration en `development` ⇒ démarrage et ligne `leads.settings.missing_at_start` (`05` CA85 ; `staging` est déployé depuis D70, il refuse). *Preuve (J9 D67-b)* : un environnement déployé refuse la base locale (D70 S1), le refus est donc prouvé sur le verdict partagé (`leads-start-check`) et l'étape de démarrage en base, pas au niveau du processus |
| TM1.14 | *(D67)* **Ordre en `dry_run`** : modèle ou liste manquant ⇒ `leads.dry_run.would_send` journalisée avec les noms des réglages manquants, **puis** ligne `failed` ; réglages présents ⇒ `succeeded` avec `dry_run` ; réglage Apollo illisible ⇒ `failed` sans `would_send` ; *(architecte, 2026-10-17)* sans consentement et liste manquante ⇒ `skipped` `no_consent`, ni `would_send` ni échec (`05` CA86, RG164) |
| TM1.15 | *(D67)* **Clé absente en production** : ligne qualifiée ⇒ `failed` `credentials_missing` ; hors production, `skipped_no_credentials` inchangé (T17.1) (`05` CA87) |
| TM1.16 | *(D67)* **Un identifiant Brevo renseigné ne redevient jamais vide** : remise à `NULL` ou retrait de la clé refusé en base, remplacement par un entier positif accepté ; *(architecte, 2026-10-17)* toute écriture sur `leads.sync_settings`, y compris par SQL direct, produit un `settings.changed` chaîné (`05` CA88, RG163) |

*Ajout du 2026-10-14 (revue de fin de J7, `testeur`) :* TM1.5 est porté par `tm1-brevo-webhook-route`
(réception, 4 cas), `tm1-brevo-inbound` (fonctions de la base : ligne brute, rapprochement, traitement,
gardes) et `tm1-brevo-inbound-worker` (traitement par le worker, 15 cas) ; les tâches E-4 qui
l'alimentent par `tm1-periodic-runs` (fonctions `ops`) et `tm1-periodic-tasks` (boucle, 13 cas). Les planchers de cas sont figés dans `apps/api/db-tests/case-floors.ts` (base) et
`apps/api/tests/case-floors.ts` (unitaire, J7T-3), contrôlés par `scripts/check-case-floors.ts unit|db`.
*Constatés à la fin du J8 (`testeur`, 2026-10-16, sur `a2ff7bc`) :* base 1 038 cas (48 fichiers),
unitaire `apps/api` 1 017 (51), contracts 80, test-kit 116, web 205, backoffice 30, e2e 24 ; `pnpm
test` = 2 486 (il enchaîne, pour `apps/api`, les tests unitaires **puis** `test:db`). Seul `apps/api`
a des planchers figés (J8T-6). Le projet `unit` a un délai Vitest de 20 s (J7T-1). En CI, un échec de
l'étape I-4 **masque les étapes suivantes** (migrations, index, format, build, Playwright) : tant
qu'elle est rouge, ces étapes se vérifient en local.

### TM2 — Révélation d'identité atomique (7 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM2.1 | La transaction est **tout ou rien** : une erreur sur la mise en file des e-mails annule la révélation, la conversation et l'événement chaîné |
| TM2.2 | Une révélation produit **exactement** : `identity_revealed_at` posé, 1 conversation, **3 participants**, 1 événement chaîné, 2 lignes d'e-mail avec leur `messageId` conservé |
| TM2.3 | `identity_revealed_at` est **write-once** : une seconde écriture lève une erreur, y compris pour `admin`, y compris par un `UPDATE` direct |
| TM2.4 | Aucune révélation sans les **deux acceptations** ni sans statut `approved` (contraintes déclaratives) |
| TM2.5 | Deux révélations **simultanées** sur la même mise en relation : une réussit, l'autre échoue proprement |
| TM2.6 | `origin`, `reference` et les deux pays historisés sont **immuables** après création |
| TM2.7 | Le blocage des doublons fonctionne : une seconde mise en relation active sur le même triplet (marque, créateur, campagne) est refusée |

### TM3 — File de validation, verrou et SLA (6 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM3.1 | **Deux commerciaux, une demande** : la transition conditionnelle atomique n'en laisse passer qu'un ; le second reçoit 409 avec le nom du titulaire |
| TM3.2 | Un verrou orphelin expire par la tâche de fond et redevient prenable |
| TM3.3 | Aucun des trois déclencheurs ne crée **directement** une conversation : ils créent une entrée de file (règle d'or du §4.1 du cadrage) |
| TM3.4 | La **proposition INFLUX** court-circuite la file mais **pas le consentement** : tant que les deux acceptations manquent, rien n'est révélé ; une sélection de cinq créateurs crée **cinq** mises en relation distinctes |
| TM3.5 | `sla_due_at` est calculé depuis `backoffice.sla_policies` — c'est un **paramètre**, pas une constante (D39) |
| TM3.6 | Un refus porte **toujours** un motif typé, et la partie visée n'est **jamais** informée (C(18)) |

### TM4 — Transitions d'état de l'affaire (8 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM4.1 | Chaque transition légale de `billing.deal_state_transitions` aboutit |
| TM4.2 | **Chaque transition illégale échoue**, testée exhaustivement (produit cartésien des états) — c'est le seul endroit où l'exhaustivité brute est justifiée, parce que la liste est courte et le coût nul |
| TM4.3 | La machine à états de `packages/domain` et la base **concordent** : un écart entre les deux est un défaut bloquant |
| TM4.4 | Une affaire est toujours rattachée à une `introduction` (`not null` + clé étrangère) : **aucune affaire orpheline** |
| TM4.5 | Les champs obligatoires par état sont exigés en base, pas seulement à l'écran |
| TM4.6 | La **devise est immuable** après `signed` |
| TM4.7 | `stalled` est produit par la tâche de fond à 14 jours, et n'est pas un état saisi |
| TM4.8 | Toute transition écrit une ligne au registre avec son auteur et sa date |

### TM5 — Transitions de campagne et cycle du badge (6 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM5.1 | Une campagne n'est publiée qu'après validation d'un commercial ; un refus porte un motif typé |
| TM5.2 | Une campagne non publiée n'apparaît dans aucune recherche créateur |
| TM5.3 | Le **badge périme à 90 jours** : après passage de la tâche, il n'est plus actif, et le retrait est journalisé comme **événement système**, pas comme décision d'agent (C(15)) |
| TM5.4 | Un badge retiré manuellement exige la double validation (ou la procédure dégradée du §1.3) |
| TM5.5 | Le profil créateur ne devient `published` qu'après modération, et un visuel non modéré n'est jamais visible d'une marque (C(16)) |
| TM5.6 | Le bloc interne d'une campagne (budget total, notes) n'est **jamais** lisible par un créateur |

### TM6 — Saisie et historisation des montants (8 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM6.1 | Montant nul ou négatif ⇒ refusé |
| TM6.2 | `agreed_commission_amount > negotiated_amount` ⇒ refusé |
| TM6.3 | `commission_received > agreed_commission` ⇒ refusé **sauf** justification renseignée |
| TM6.4 | Devise hors liste fermée ⇒ refusée ; montant sans devise ⇒ refusé |
| TM6.5 | `signed_at` antérieure à `identity_revealed_at` ⇒ refusée |
| TM6.6 | Toute modification d'un montant ou d'une date écrit une ligne dans `billing.deal_field_changes` — **écrite par le déclencheur**, donc incontournable même si le code applicatif l'oublie |
| TM6.7 | `billing.deal_field_changes` est append-only (mêmes tests que T3.1) |
| TM6.8 | **L'exemple de référence** : 2 000,00 EUR saisis, 700,00 EUR de commission saisis, le net affiché 1 300,00 EUR est une **soustraction à la lecture**, jamais une colonne stockée, jamais un calcul de taux |

### TM7 — Détection de coordonnées (4 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM7.1 | Le corpus figé (§6) : chaque cas positif est détecté avec le **bon type** |
| TM7.2 | **Zéro faux positif** sur la liste blanche — bloquant |
| TM7.3 | **Aucune régression** : un cas détecté par la version précédente du détecteur reste détecté |
| TM7.4 | La détection stocke **le type et la position, jamais le texte** (C(26), R-6), et porte sa `detector_version` |

### TM8 — Envoi d'e-mails depuis le backoffice (6 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM8.1 | Saisie libre **unitaire uniquement**, plafonnée par rôle, journalisée nominativement |
| TM8.2 | Lien de désinscription présent dans **tous** les envois |
| TM8.3 | L'adresse est vérifiée contre la liste des désinscrits **au moment de l'envoi**, pas de la sélection |
| TM8.4 | Fenêtre d'annulation de 5 minutes réellement respectée |
| TM8.5 | Envoi de masse impossible sans double validation et re-authentification |
| TM8.6 | **Un agent ne peut pas modifier le consentement d'un membre** (C(36)) |

### TM9 — Demandes RGPD et propagation (5 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM9.1 | Un export contient les données du demandeur **et rien d'autrui** |
| TM9.2 | Une anonymisation propage la suppression vers Brevo et Apollo (doublures) |
| TM9.3 | Le registre d'audit **survit** à l'anonymisation (conservation probatoire) et ne contient que des identifiants — **sous réserve de la validation R-1 par `expert-conformite-rgpd`** (§9.2) |
| TM9.4 | L'exécution exige `admin`, double validation et re-authentification ; elle n'est jamais déclenchée par une route HTTP |
| TM9.5 | `due_at` = reçu + 30 jours, colonne générée, non modifiable |

### TM10 — Inscription : validations pures (5 cas)

Les tests existants de `apps/web/tests/start-form-validation.test.ts` sont **conservés et étendus** :
ils portent sur une fonction pure, ils sont rapides, et ils ont déjà attrapé le bon sujet (consentement
jamais pré-coché).

| Cas | Ce qu'il vérifie |
|---|---|
| TM10.1 | Consentement marketing **jamais pré-coché**, à l'initialisation et après changement de profil (déjà couvert) |
| TM10.2 | Attestation de majorité exigée pour un créateur (déjà couvert) |
| TM10.3 | **La même validation est rejouée côté serveur** : un appel direct à l'API contournant le front est refusé de la même façon. C'est le cas manquant aujourd'hui |
| TM10.4 | La version de CGU acceptée est **enregistrée** et correspond à la version en vigueur à l'instant de l'inscription |
| TM10.5 | Pays et langue sont des données explicites, sans valeur par défaut « France / français » |

### TM11 — Anonymisation au niveau des types et des schémas de réponse (4 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM11.1 | **Aucun type exposé à une marque ne porte de champ identifiant** — la garde annexe actuelle sur `CreatorCard`, promue en règle permanente et étendue à tous les contrats de `packages/contracts` |
| TM11.2 | Aucun schéma de réponse Fastify accessible au rôle `advertiser` ne déclare un champ de `creator_identities` |
| TM11.3 | Aucun import de `@supabase/*`, `drizzle-orm`, `pg` ou `postgres` dans `apps/web` et `apps/backoffice` (règle ESLint, doublée d'un test au cas où la règle serait désactivée en ligne) |
| TM11.4 | **Pas de réponse sans schéma** (`02` §4 règle 1, `21` J1-E ; **Lot 0, J1**). (a) Un champ non déclaré dans le schéma de réponse n'est jamais sérialisé. (b) Une route **sans** schéma de réponse, avec un schéma de réponse **vide** (`response: {}`), ou **sans aucun code `2xx`** ⇒ l'API refuse de démarrer. (c) Une route qui renvoie un **code non déclaré** dans son schéma, ou un corps qui viole son schéma ⇒ `500` en enveloppe, **sans aucun champ du corps d'origine** (T13). Sans (b) et (c), le filtre de sortie ne vaut que pour les routes qui ont pensé à le déclarer |

### TM12 — Recherche (6 cas)

| Cas | Ce qu'il vérifie |
|---|---|
| TM12.1 | K-anonymat à 5 : une combinaison de facettes isolant moins de 5 profils ne renvoie pas de résultat |
| TM12.2 | Pagination plafonnée côté serveur, quelle que soit la valeur demandée |
| TM12.3 | **Export interdit à tout le monde, y compris `admin`** (C(17)) : aucune route, aucun format |
| TM12.4 | Chaque recherche est journalisée dans `search.search_queries` |
| TM12.5 | La vue **identifiée** est refusée aux rôles `advertiser` et `creator`, en base |
| TM12.6 | L'`alias` public est aléatoire, non séquentiel, non dérivé de l'identifiant de compte (I-2) : test statistique sur 1 000 générations |

### 3.2 Total des cas spécifiés

| Famille | Cas |
|---|---|
| T1 à T17 (exigés par `expert-cybersecurite`) | **130** |
| TM1 à TM12 (métier) | **81** *(75 + 6, TM1.11 à TM1.16, 2026-10-17, D67)* |
| **Total** | **211 cas de test**, dans **29 familles** |
| En complément | 1 corpus figé de **120 cas** de détection (§6), 1 parcours de bout en bout en **12 étapes** + 1 parcours négatif (§7), 2 contrôles non automatisés (X3, X4) |
| Jalon DS (D73, 2026-10-28), **hors total ci-dessus** | Familles **TD1 à TD8**, **44 cas** plus la matrice d'axe de TD7 (§12) : jalon extra du MVP, entre le Lot 1 et le Lot 2 |

---

## 5. Le sort des gardes existantes de `apps/web`

`apps/web/tests/guards.test.ts` contient **G1 à G7 plus quatre gardes annexes**. Elles ont bien
fonctionné et le §13.1 du document `02` décide de les lever **chirurgicalement**. Mon rôle ici est de
garantir qu'**aucune protection ne disparaît sans contrepartie**.

> **Préalable, valable pour toutes les gardes conservées.** Elles vivent aujourd'hui dans un fichier
> de `apps/web` qui ne voit que `apps/web`. Les décisions « conservé **et étendu** à
> `apps/backoffice` et `packages/ui` » ne sont pas applicables en l'état. **Exigence du Lot 0 :
> extraire les gardes dans un harnais partagé** (par exemple `packages/guards`, forme à valider par
> `architecte`), paramétré par la liste des paquets à balayer. Sans cela, « étendu » restera un mot.

| Garde | Ce qu'elle protège, en clair | Décision (`02` §13.1) | **Contrepartie exigée** | Lot |
|---|---|---|---|---|
| **G1** — aucun `mailto:` ni `tel:` | Le contournement : une adresse cliquable dans une page est une sortie de plateforme | **Conservée au Lot 0, resserrée au Lot 1** | Interdiction **maintenue et durcie** dans l'espace membres, le backoffice et **tout composant affichant du contenu utilisateur**. Autorisée uniquement sur les pages légales et la page de contact publique, par une liste blanche de fichiers **nommés**, pas par un chemin de dossier | 0-1 |
| **G2** — aucune URL `http(s)://` | La fuite vers un tiers, l'appel réseau non prévu | **Levée au Lot 1** | **Trois remplaçants, pas un** : (a) garde resserrée — aucune URL littérale hors de `src/config/` et `src/locales/` ; (b) **CSP testée en production** (T10.6) ; (c) règle ESLint interdisant `fetch` hors du seul `src/server/api-client.ts` (dans `packages/web-platform` depuis PL-09). La garde passe d'une vérification de lecture à une vérification d'exécution : c'est **plus fort**, à condition que (b) existe le jour où (a) est levée — **dans le même commit** | 1 |
| **G3** — aucune couleur ni longueur en dur | L'invariant du design system (`CLAUDE.md` §4) | **Conservée définitivement, étendue** | Étendue à `apps/backoffice`, `packages/ui` et `packages/web-platform` (PL-09, avec G1 et G2) **via le harnais partagé**. Aucune contrepartie nécessaire : rien n'est levé | permanent |
| **G4** — chaque photo est créditée | Le risque juridique des visuels d'illustration | **Conservée tant que `src/content/placeholders/` existe, supprimée avec lui au Lot 1** | **Remplacée par une garde d'absence** : aucun fichier image dans le dépôt en dehors d'un manifeste d'actifs de marque déclaré. Le risque change de nature au Lot 1 (les visuels deviennent des portfolios déposés par des créateurs) et il est alors porté par la **modération** et par T9. Sans la garde d'absence, une photo non créditée pourrait revenir sans bruit | 1 |
| **G5** — aucun `route.ts` sous `src/app` | L'apparition d'un point d'accès serveur non prévu dans une maquette | **Levée au J1 dans le commit du passe-plat, remplacée par une garde plus stricte** (EC-13, `21` §4 J1-C) | **Garde de remplacement**, écrite une fois dans `packages/test-kit` et appliquée aux deux fronts : (a) les fichiers de route sous `src/app` sont **exactement** `{ src/app/api/[...path]/route.ts }` (EC-22 y ajoutera `src/app/health/route.ts`) ; (b) **aucun dossier `src/pages/` ni `pages/`** — le routeur historique de Next.js ouvrirait des routes `pages/api/*` hors de la liste blanche ; (c) `route.ts`, `src/server/relay.ts` et `src/server/api-client.ts` n'importent ni `@supabase/*`, ni `drizzle-orm`, ni `pg`, ni `postgres`, ne lisent pas `process.env` et ne contiennent pas `'use server'` ; (d) **garde des importeurs** (`relay.ts` importé par `route.ts` seul, `api-client.ts` par `relay.ts` seul, `src/config/server.ts` par `api-client.ts` seul) ; (e) **empreinte SHA-256** des quatre fichiers, identiques octet pour octet dans les deux fronts (T7.8). *Depuis PL-09 (arbitrage PL-07) : `relay.ts`, `api-client.ts`, `config/server.ts` et le client navigateur vivent dans `packages/web-platform` ; (c) à (e) s'y appliquent, `route.ts` reste une copie épinglée dans chaque front qui importe `@influx/web-platform/relay`, seul importeur avec la route de santé ; l'identité entre copies devient une garde d'absence (aucun fichier du paquet copié dans un front) et les `exports` du paquet sont figés.* **Tests** : les conditions PP en **unitaire dès le J1** (PP-2, PP-3, PP-5, PP-7, PP-9, PP-10, PP-11 contre un faux serveur HTTP local ; T7.9 côté `apps/api`) et T7.10 ; **T7 complet, en intégration, au J9**. Le remplacement est nettement plus fort que l'original, et il survit à la vraie application | 0 (J1) |
| **G6** — `IS_MOCKUP === true` | Qu'un site de démonstration soit pris pour le vrai, ou indexé | **Conservée jusqu'au retrait du module fictif au Lot 1, puis supprimée** | **Deux remplaçants** : (a) une **garde d'absence** — le module fictif, la constante `IS_MOCKUP` et le composant de bandeau **n'existent plus** dans le dépôt, de sorte qu'ils ne peuvent pas revenir silencieusement ; (b) la non-indexation devient une affaire d'environnement, **testée** (T10.4 pour le backoffice, en-tête `noindex` sur `staging` pour I-6). Point non automatisable, à vérifier à l'œil : le bandeau disparaît **dans le même commit** que la première donnée réelle, jamais avant | 1 |
| **G7** — aucun conflit de classes Tailwind | Une régression visuelle silencieuse déjà survenue deux fois | **Conservée et étendue** | Étendue à `apps/backoffice` et `packages/ui` via le harnais partagé. L'auto-test du détecteur (dernier cas actuel) est **conservé** : c'est une bonne pratique, un détecteur qui ne sait plus détecter est un test qui ment | permanent |
| *(annexe 1)* — parité des clés FR/EN | Un écran à moitié traduit en production | **Conservée, étendue** à tous les fichiers de traduction de `apps/web`, pas seulement `landing.json` | **`apps/web`** : parité des clés sur tous les fichiers de `src/locales/<langue>/`. **`apps/backoffice`, tant que D36 est ouverte** (français seul, sans `next-intl` ; EC-25, appliquée au J1) : la garde vérifie (a) **un seul module de libellés, `src/messages/fr.ts`** : `src/messages/` ne contient rien d'autre, et aucun autre fichier de `src/` ne porte pour nom un code de langue (`fr`, `en`, `pt`, `es`, `de`, `it`, avec ou sans région : `en.ts`, `pt-BR.ts`, `fr_FR.ts`…) — `src/i18n/en.ts` fait échouer la garde ; (b) **aucun dossier `locales/` ni `i18n/`** sous `src/` ; (c) **aucun fichier `.json` sous `src/`** ; (d) **`next-intl` absent** de `package.json` et de tout import. La décision D36 reste ainsi visible dans le code. **Si D36 ouvre le backoffice à l'anglais**, cette garde est remplacée, dans le commit qui ajoute la seconde langue, par la parité des clés de `apps/web` | permanent |
| *(annexe 2)* — aucune API réseau ni stockage | Le vol de session par JavaScript, l'appel réseau sauvage | **Scindée au J1**, dans le commit qui lève G5 (`21` §4 J1-C, point 1) | **(a)** `fetch` : autorisé **dans le seul** `src/server/api-client.ts`, interdit ailleurs (ESLint + garde) ; depuis PL-09, ce module et `src/browser/relay-client.ts` sont dans `packages/web-platform`, et aucun fichier d'un front n'y fait exception. **(b)** `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `cookieStore`, `sendBeacon` : **interdits définitivement**, sans exception et sans liste blanche — la session est un cookie `httpOnly` (A-9). Le second volet est plus important que le premier et ne doit jamais être assoupli « pour un besoin de confort » | 0 (J1) puis permanent |
| *(annexe 3)* — valeurs fictives confinées | Qu'un nom inventé se retrouve en production | **Conservée jusqu'au Lot 1**, disparaît avec le module fictif | Remplacée par la garde d'absence de G6. Aucune protection perdue : sans module fictif, il n'y a plus de valeur fictive à confiner | 1 |
| *(annexe 4)* — `CreatorCard` sans champ d'identité | **A2 / D16 au niveau du type** | **Conservée et promue en règle permanente** | Devient **TM11.1**, généralisée : *aucun type exposé à une marque ne porte de champ identifiant*, appliquée à tout `packages/contracts`. Doublée par T1 (charge utile brute) et par T2 (droits en base). C'est la garde qui monte le plus en importance dans tout ce tableau | permanent |

**Bilan.** Quatre gardes sont levées (G2, G4, G5, G6) et trois annexes évoluent. **G5 et l'annexe 2
l'ont été au J1** (EC-13) ; **G1, G2, G4, G6, la parité FR/EN de `apps/web` et le confinement du
module fictif restent en place jusqu'au J9**. Chacune reçoit une contrepartie **plus forte** que
l'originale, à une condition de calendrier non négociable :

> **Une garde n'est levée que dans le commit qui introduit son remplaçant, jamais avant.** Un lot qui
> lève G2 sans livrer la CSP testée, ou G5 sans livrer la garde de liste blanche et les tests
> unitaires du passe-plat (T7 complet au J9), n'est pas livrable.

### 5.1 Les gardes du jalon DS, charte KEO Emerald *(ajouté le 2026-10-28, D73, `02` §21.6)*

Les lecteurs vivent dans `@influx/test-kit/guards`, avec leur auto-test (TD1) : un détecteur qui ne sait
plus détecter est un test qui ment (G7). **Un seul lecteur de valeur effective**,
`effectiveTokens(css, charte)` (bloc KEO, sinon `@theme`, sinon `:root`, alias suivis ; cycle ou cible
absente = erreur), sert G3b à G3f. `tokenValue` (première occurrence du fichier) ne sert plus aux
contrôles par charte : il lirait la vitrine et laisserait KEO sans contrôle, tout en restant vert.

| Garde | Statut | Ce qu'elle prouve | Réserves et amendements de `testeur` |
|---|---|---|---|
| **G3** | Amendée | Un seul fichier de jetons, `packages/ui/src/styles/tokens.css`, importé par chaque `globals.css` (plus `tokens-backoffice.css` au backoffice), aucune couleur ni longueur littérale ailleurs, `keo-emerald.css` jamais importé (aucune feuille de plus) | Couvre les valeurs KEO littérales (hexadécimal, fonctions, longueurs, valeurs arbitraires `bg-[#…]`). Trou connu : une couleur nommée (`white`) dans une valeur arbitraire ; un `style=` en ligne est refusé à l'exécution par la CSP. Aucun faux positif attendu sur `fonts.ts` (plages `U+…` sans unité). L'en-tête « D73 » du fichier est cosmétique : ce n'est pas lui qui protège |
| **G3b** | Amendée | D72 : rouges opaques, identiques entre fronts **et entre chartes** (`KEO_INHERITS`), aucune classe translucide | Ses ratios passent dans la matrice de G3d (un seul endroit où l'on calcule). Lecture **par charte**, avec un cas négatif (un rouge KEO insuffisant doit échouer) ; sinon elle reste verte sur la vitrine pendant que KEO se dégrade |
| **G3c** | Nouvelle | Bloc KEO unique, dans `tokens.css` seul ; noms ⊆ déclarés ; tout `--color-*` redéfini, hérité (`KEO_INHERITS`) ou réservé à la vitrine (`VITRINE_ONLY`) ; valeurs opaques ; aucun `!important` ; fermeture des alias | Fermeture sur **toute référence `var()`** (alias entier, `calc(var(…))`), **transitive**, en `@theme` et en `:root`. Entrée périmée d'une des deux listes refusée, chaque entrée justifiée par un commentaire. `VITRINE_ONLY` est le pendant de G8 : un jeton listé ne peut pas être consommé sous KEO |
| **G3d** | Nouvelle | Matrice de contrastes par charte, en données relues par `expert-ux` (`20` §11.4) | Texte ≥ 4,5:1 ; **non-texte ≥ 3:1** : bordure de champ, contour du bouton secondaire (alias, donc via la fermeture), anneau de focus, forme du bouton principal et du bouton rouge (3,05:1 sur carte : marge de 0,05) ; états survol et appui. **Les paires, les seuils et la teinte du succès sont des données**, pas du code : une constante nommée `SUCCESS_MIN_HUE_GAP` (degrés) et le tableau des paires sont lus dans un seul module de données, dont les valeurs renvoient à `20` §11.4 et que `expert-ux` tient à jour ; la garde calcule, elle ne décide pas. Valeur de départ **20°** (`02` §21.8) ; `expert-ux` ajuste le succès sous KEO (par exemple `#3ccfcf`, 24,6°) : si la valeur retenue passe sous le seuil, le seuil ne baisse que par un arbitrage écrit du fondateur, avec `CLAUDE.md` §4 amendé, et G3d interdit alors un succès en fond plein. Ne voit ni un état ni un usage non listé : d'où G3h, axe et la sonde TD3 |
| **G3e** | Nouvelle | Vitrine figée : déclarations de `@theme`, de `:root` et des `@media` | Instantané pris **avant** toute modification (DS-1), ajouts permis, modification = commit qui nomme les valeurs. Si F2 (un seul vert) est accepté : liste explicite des noms modifiés. Ne voit ni un composant partagé ni `globals.css` : doublée par l'empreinte de styles calculés TD4 |
| **G3f** | Nouvelle | Aucun `-bo-` dans `apps/web/src` ; `tokens-backoffice.css` ne déclare que des `--*-bo-*`, contrastés contre KEO | Triviale et gardée |
| **G3g** | Nouvelle *(ajoutée)* | Couleurs de rôle confinées (P7, `12` RG7) : `color-role-*` consommé par le seul composant de la liste fermée de `20` §11.3 (point + rôle écrit, libellé obligatoire par le type) ; aucune classe `text-`, `border-` ni `bg-` de rôle ailleurs | Testable **en partie** : le confinement, statiquement ; l'exécution, par la sonde TD5 (tout élément peint d'une couleur de rôle porte le rôle écrit). Le **sens** (bon libellé, point décoratif) reste en revue |
| **G3h** | Nouvelle *(ajoutée, facultative)* | Aucune paire interdite par `20` §11.4 dans un même littéral de classe (`text-tertiary` ou texte d'erreur sur `surface-active`) | Rappel faible (même littéral seulement), coût nul ; axe reste le filet |
| **G4f** | Nouvelle | Polices : fichiers sous `packages/ui/src/styles/fonts/` seulement, manifeste ↔ fichiers dans les deux sens, SHA-256, signature `wOF2`, licences OFL, aucune copie dans un front (absence, PL-08), budget | `*.woff2 binary` est déjà au `.gitattributes`. G4f ne voit que les sources : ce qui est **réellement préchargé** se mesure en e2e (TD3) |
| **G8** | Nouvelle | Séparation des deux chartes dans `apps/web` | À éclater en `it` distincts. `data-theme` et l'import de `@influx/ui/fonts` limités aux deux mises en page ; `createPortal` interdit partout dans `src/` (aucun usage aujourd'hui : pas de portée à définir) ; modules de la vitrine (liste nommée, existence vérifiée) hors du segment `(member)` ; transformations d'état et `transition-all` : `transition-all` interdit ; transformation d'état acceptée **sous `motion-safe:` seulement** (F6, fondateur, 2026-10-29 ; `20` §11.5, `02` §21.5 point 7), garde amendée à DS-5 ; les pages de `MEMBER_PAGE_SLUGS` sont **exactement** celles de `(member)` (le déplacement ne change aucune URL) |
| **G9** | Nouvelle *(ajoutée)* | Lecture de session confinée aux coquilles et à `member-auth` / `backoffice-auth` (garde des importeurs, comme G5 d) | `02` §21.9 l'exige du développeur sans la garde qui la prouve |
| **ESLint** | Amendée | `lucide-react` hors `icons.ts` ; `next/font/local` hors `packages/ui` | Le lint est le test : aucun cas de plus |

**Gardes du jalon RK** *(ajouté le 2026-10-30, D75, `02` §21.3 point 3, `archives/jalons/rk-fiche.md`)*. Même
règle : chaque garde a son auto-test, cas négatif compris (R4 : vu rouge sur le parent).

| Garde | Statut | Ce qu'elle prouve | Réserves de `testeur` |
|---|---|---|---|
| **G3i** (TK7.1) | Nouvelle | **(a) sources** : échec si le bloc KEO redéfinit un nom des espaces `--shadow-`, `--inset-shadow-`, `--drop-shadow-`, `--text-shadow-`, `--breakpoint-`, `--container-`, si `tokens.css` contient `@theme inline`, ou si un `color-mix` sort de la liste de RK-A (trois tokens, halo ≤ 15 %, liste en données dans `charter-data.ts`). **(b) construction** (une spec par front, feuilles servies) : tout utilitaire d'un token redéfini sous KEO lit `var(--nom)`, jamais la valeur vitrine | Auto-test : `.shadow-action-glow{--tw-shadow:none}` échoue, CSS minifié et CRLF compris ; token redéfini sans consommateur = échec sauf entrée justifiée. (a) seule ne suffit pas : un futur espace de noms inscrit en dur ne se voit que sur la construction |
| **TK7.2** | Nouvelle | Toute classe littérale des fichiers de classes a une règle compilée (liste blanche justifiée) | Négatif : `tracking-wide` (aucun token, aucune règle : constat C3) |
| **G8 étendue** (TK7.3, TK7.4) | Amendée (seule extension admise) | Aucun `clamp(` ni `vw` dans les `--text-*` et `--tracking-*` effectifs sous KEO ; `text-display`, `text-heading-*`, `text-lead`, `text-figure-*` refusés sous KEO ; `motion-safe:…active:scale-(--scale-press)` accepté ; `active:scale-…` et `hover:scale-…` hors `motion-safe:` refusés | Étend G8 sans l'assouplir : tout ce qu'elle refusait reste refusé |
| **TK7.5** | Nouvelle | `badge-error-bg` consommé par le seul badge d'erreur (confinement, comme G3g) ; aucune propriété de lissage déclarée dans `:root`, `html` ou `body` | Le confinement interdit aussi le fond d'une notice (D72, DZ-6) |

G1 à G9 ne s'assouplissent jamais dans ce jalon ; seule G8 s'étend.

**Garde existante touchée.** La parité FR/EN de `apps/web` compare une **liste exacte** de fichiers
(`account`, `auth`, `errors`, `landing`, `legal`) : un nouveau fichier de traduction de la coquille la
casse. Elle s'amende dans le commit qui l'ajoute ; la parité des clés le couvre ensuite.

---

## 6. Le corpus de test de la détection de coordonnées

### 6.1 Pourquoi un corpus figé, et pourquoi une centaine de cas

Le détecteur de coordonnées est la seule brique du MVP dont la **qualité n'est pas binaire**. Une
politique RLS fonctionne ou ne fonctionne pas ; un détecteur, lui, a un rappel et une précision, et il
se dégrade à chaque modification de sa configuration. Quatre raisons imposent un corpus :

1. **Sans corpus, chaque modification est un pari.** Ajouter une expression régulière pour attraper
   « zéro six douze » casse silencieusement la détection de « 06.12 » ou fait hurler le détecteur sur
   un budget écrit en toutes lettres. On ne s'en aperçoit qu'en production, par la lassitude du
   commercial.
2. **Le faux positif coûte plus cher que le faux négatif.** Un signal manqué est rattrapé par le
   commercial, qui est dans le fil (`01` §M5). Un signal faux répété fait cesser la lecture des
   signaux : la fonctionnalité meurt d'être bruyante.
3. **La détection évoluera après le pilote**, et `messaging.contact_detections` porte une
   `detector_version` **précisément** pour permettre de rejouer le corpus. Le corpus est donc déjà
   prévu par le modèle de données : il ne reste qu'à l'écrire.
4. **Une centaine de cas est le bon ordre de grandeur** : assez pour couvrir six familles dans deux
   langues avec leurs variantes d'obfuscation, assez peu pour être relu par un humain en une heure et
   maintenu sans lassitude. Mille cas ne seraient jamais relus.

**Figé** signifie : *on ajoute, on ne modifie jamais un cas existant, on ne supprime jamais*. Un cas
qui se révèle mal qualifié est **re-qualifié avec une note datée**, il reste dans le fichier. C'est ce
qui permet de dire, dans six mois, ce que le détecteur savait faire au premier jour.

### 6.2 Structure du corpus

Un fichier de données, versionné, séparé du code du détecteur (forme exacte à valider par
`architecte` — JSON ou YAML) :

```jsonc
// Illustration — packages/domain/fixtures/contact-detection-corpus.json
{
  "corpus_version": 1,
  "cases": [
    {
      "id": "fr-email-obf-003",
      "lang": "fr",
      "family": "email",              // email | phone | social_handle | messaging_link | iban | url
      "kind": "positive",             // positive | negative (liste blanche)
      "text": "tu peux m'écrire à jean.dupont arobase gmail point com",
      "expected": [{ "type": "email", "start": 22, "end": 57 }],
      "obfuscation": "mots_ecrits",   // aucune | ponctuation | mots_ecrits | espacement | chiffres_lettres | image_decrite
      "origin": "synthétique",        // JAMAIS "observé" : aucune donnée réelle (§1.3, règle 3)
      "added_at": "2026-09-18",
      "note": ""
    }
  ]
}
```

| Champ | Rôle |
|---|---|
| `id` | Stable à vie, cité dans les messages d'échec et dans les tickets |
| `lang` | `fr` ou `en` — au moins 40 % de chaque |
| `family` | Les six types de `messaging.contact_detections` |
| `kind` | `positive` (doit être détecté) ou `negative` (**ne doit pas** l'être) |
| `expected` | Type **et position** — pas seulement « quelque chose a été trouvé » : le type juste compte, sinon l'agent voit « IBAN » là où il y a un pseudo |
| `obfuscation` | Permet de mesurer le rappel **par niveau d'obfuscation**, qui est la vraie information |
| `origin` | **Toujours synthétique.** Aucune valeur observée, même anonymisée : c'est une règle de ce plan (§1.3) et un point RGPD (§9.2) |
| `added_at`, `note` | Traçabilité d'une re-qualification |

**Répartition cible, 120 cas :**

| Famille | Positifs FR | Positifs EN | Négatifs (liste blanche) |
|---|---|---|---|
| E-mail | 12 | 10 | 4 |
| Téléphone | 14 | 10 | 6 |
| Identifiant social | 10 | 8 | 5 |
| Lien / raccourcisseur / messagerie tierce | 8 | 6 | 6 |
| IBAN et coordonnées bancaires | 4 | 2 | 2 |
| Invitation à changer de canal | 6 | 4 | 3 |
| **Total** | **54** | **40** | **26** — soit **120 cas** |

### 6.3 Vingt-deux cas positifs représentatifs

| # | Langue | Famille | Texte du message (inventé) | Obfuscation |
|---|---|---|---|---|
| 1 | FR | e-mail | `tu peux m'écrire à jean.dupont arobase gmail point com` | mots écrits |
| 2 | FR | e-mail | `mon mail : j[dot]dupont[at]protonmail[dot]com` | ponctuation |
| 3 | FR | e-mail | `contacte-moi chez prenom.nom (a) exemple-invalide.fr` | ponctuation |
| 4 | EN | e-mail | `reach me at jane dot doe at outlook dot com` | mots écrits |
| 5 | EN | e-mail | `j-doe AT company DOT co DOT uk, easier than here` | mots écrits |
| 6 | FR | téléphone | `06 12 34 56 78` | aucune |
| 7 | FR | téléphone | `06.12.34.56.78, appelle quand tu veux` | ponctuation |
| 8 | FR | téléphone | `+33 6 12 34 56 78` | aucune |
| 9 | FR | téléphone | `0 6 1 2 3 4 5 6 7 8` | espacement |
| 10 | FR | téléphone | `zéro six, douze, trente-quatre, cinquante-six, soixante-dix-huit` | chiffres en lettres |
| 11 | EN | téléphone | `six one seven five five five zero one four seven` | chiffres en lettres |
| 12 | EN | téléphone | `(212) 555-0147 — call me tomorrow` | aucune |
| 13 | EN | téléphone | `07700 900123` (plage de test britannique) | aucune |
| 14 | PT-BR *(cas frontière, message en EN)* | téléphone | `+55 11 91234-5678` | aucune |
| 15 | FR | identifiant social | `insta : @marie_cuisine_test` | aucune |
| 16 | FR | identifiant social | `retrouve-moi sur IG, c'est marie underscore cuisine` | mots écrits |
| 17 | EN | identifiant social | `find me on TikTok: tiktok.com/@mariecuisinetest` | aucune |
| 18 | FR | lien | `mon linktree : linktr.ee/mariecuisinetest` | aucune |
| 19 | FR | lien / raccourcisseur | `tout est là 👉 bit.ly/3xYzAbTest` | raccourcisseur |
| 20 | FR | changement de canal | `on peut basculer sur WhatsApp ? c'est plus simple, je te donne mon numéro` | invitation |
| 21 | EN | changement de canal | `let's take this off-platform, I'll send you everything by email` | invitation |
| 22 | FR | IBAN | `FR76 3000 6000 0112 3456 7890 189` | aucune |

*(Vingt-deux cas cités : les deux derniers sont les plus intéressants à traiter en premier, parce
qu'une invitation à changer de canal ne contient aucune coordonnée et échappe à toute expression
régulière naïve.)*

### 6.4 Les faux positifs à ne jamais déclencher — la liste blanche

C'est la moitié du corpus qu'on oublie toujours d'écrire, et c'est elle qui fait vivre ou mourir la
fonctionnalité.

| # | Langue | Texte légitime | Pourquoi c'est légitime |
|---|---|---|---|
| N1 | FR | `notre gamme est ici : https://www.marque-exemple.fr/collections/hiver` | **URL produit dans un brief.** Cas explicitement cité comme faux positif assumé (`01` §M5) |
| N2 | FR | `on parle bien de la marque marque-exemple.fr, oui` | **Domaine vérifié de l'annonceur**, déjà connu de la plateforme : jamais un contournement |
| N3 | FR | `merci de mentionner @marqueexemple et le hashtag #MarqueExempleHiver` | **Le `@` de l'annonceur lui-même**, qui est précisément l'objet de la campagne. Détecter ici serait absurde — et c'est le faux positif le plus probable de tous |
| N4 | EN | `please tag @brandexample in the caption` | Idem en anglais |
| N5 | FR | `réf. commande 0612345678` | Une référence numérique à dix chiffres n'est pas un téléphone |
| N6 | FR | `SIRET 123 456 789 00012` | Identifiant d'entreprise, format proche d'un numéro espacé |
| N7 | FR | `budget 2 000 € sur 3 mois, livraison 24-48 h` | Chiffres nombreux, aucune coordonnée |
| N8 | FR | `l'audience fait 50 000 abonnés, 18-25 ans à 60 %` | Idem |
| N9 | FR | `campagne du 06/12 au 34e jour` *(volontairement piégeux)* | Une date écrite `06/12` ne doit pas ouvrir la porte à `06.12.34…` |
| N10 | EN | `use code INFLUX2026 at checkout` | Code promotionnel |
| N11 | FR | `le format 9:16 en 1080 x 1920` | Ratios et dimensions |
| N12 | EN | `deliverables: 3 stories + 1 reel, due Oct 12` | Aucune coordonnée |

**Un point non évident.** Les cas N2 et N3 ne sont pas traitables par une expression régulière : ils
exigent de **comparer au domaine et au compte vérifiés de l'annonceur de la conversation**. C'est une
exigence fonctionnelle que je remonte à `product-owner` et à `expert-ux` dans le cadre de **D30** :
sans elle, le détecteur criera sur chaque brief et sera désactivé en deux semaines.

### 6.5 Les seuils

| Mesure | Seuil | Bloquant ? |
|---|---|---|
| Faux positifs sur la liste blanche | **0** | **Oui** |
| Régression (un cas positif détecté hier ne l'est plus) | **0** | **Oui** |
| Type de détection correct sur les positifs détectés | **100 %** | **Oui** |
| Rappel global sur les positifs | Mesuré au Lot 4, **seuil fixé après la première mesure** | **Non au départ** |
| Rappel sur les cas `obfuscation = aucune` | **100 %** | **Oui** — ne pas détecter `06 12 34 56 78` serait indéfendable |

> **Pourquoi le rappel global n'est pas bloquant au départ.** Fixer un seuil avant d'avoir mesuré
> pousse à durcir le détecteur jusqu'à l'atteindre, donc à produire des faux positifs, donc à tuer le
> signal. On mesure d'abord, on décide ensuite, et on ne descend jamais. C'est la seule zone de ce
> plan où j'assume un seuil différé — parce que la détection est la cinquième et dernière des
> protections, pas la première.

---

## 7. Le parcours de bout en bout du Lot 6

**Un seul parcours nominal, et un seul parcours négatif.** L'E2E est coûteux et fragile : on le
réserve à ce qui fait gagner de l'argent. Toutes les variantes (refus, expiration, erreur de tiers)
sont couvertes en intégration, où elles sont rapides et stables.

**Conditions d'exécution :** base jetable alimentée par `supabase/seed`, **horloge contrôlée**
(aucun `sleep`), **doublures** pour Brevo, Apollo et l'envoi d'e-mails, `SYNC_MODE=dry_run`, comptes
de démonstration nommés `*.test.invalid`. Outil : **tranché (architecte, 2026-10-08) : Playwright**
(§9.3 A-5).

### 7.1 Le parcours nominal, en douze étapes vérifiables

| # | Étape | Ce qui est vérifié à la fin de l'étape |
|---|---|---|
| **E1** | **Inscription d'une marque** : code à 6 chiffres, CGU acceptées, consentement **non pré-coché**, pays et langue | Compte créé, `terms_acceptances` porte la version en vigueur, `consent_events` porte le choix réel |
| **E2** | **Inscription d'un créateur** : idem + attestation de majorité | Idem ; un mineur déclaré est refusé |
| **E3** | **Synchronisation des leads** | 2 comptes ⇒ 6 lignes `outbox_events` (contact Brevo, contact Apollo, bienvenue), toutes `succeeded` en `dry_run` (`development`), `contact_sync_states` à jour, **aucun appel sortant réel** (`staging` envoie pour de vrai depuis D70) |
| **E4** | **Profil créateur** : couche anonyme publiée, couche identifiante remplie, preuve déposée, **badge attribué par un commercial** | Le badge existe, il est **daté**, sa péremption est calculée ; la pièce de vérification est en compartiment privé |
| **E5** | **Profil marque + campagne** créée puis **validée par un commercial** | La campagne est `published` ; avant validation, elle n'apparaissait nulle part |
| **E6** | **Recherche anonymisée côté marque** | Le créateur apparaît ; **aucun marqueur identifiant dans la charge utile** (rejeu de T1 sur la page réelle) ; export absent ; pagination plafonnée |
| **E7** | **Demande de contact** déposée par la marque | Entrée en file `pending_review`, `sla_due_at` calculé ; **le créateur ne voit rien** |
| **E8** | **Prise en charge et validation** par un commercial | Verrou nominatif posé, `approved`, `owner_agent_id` renseigné ; un second commercial reçoit 409 |
| **E9** | **Acceptation des deux parties puis révélation** | **En une transaction** : `identity_revealed_at` posé, 1 conversation, **3 participants**, 1 événement chaîné, **2 e-mails en file** portant la référence `MER-…` |
| **E10** | **Conversation à trois** | Les trois écrivent ; le commercial est **visible et nommé** ; la lecture par un agent **non participant** crée exactement une ligne de `conversation_access_log` ; un message contenant `06 12 34 56 78` produit une détection de type `phone` **sans copie du texte** |
| **E11** | **Affaire enregistrée** : `open` → `negotiating` (2 000,00 EUR) → `contract_sent` (canal) → `signed` (commission 700,00 EUR) → `commission_invoiced` → `commission_received` | Chaque transition écrit au registre ; le net 1 300,00 EUR est **affiché par soustraction** ; une correction de montant écrit une ligne dans `deal_field_changes` |
| **E12** | **Contrôles de fin de parcours** | La **chaîne d'audit est vérifiée entière** et renvoie `ok` ; `billing.commission_rates` est toujours **vide** ; aucun marqueur identifiant n'est apparu dans un e-mail destiné à la marque **avant** E9 |

### 7.2 Le parcours négatif, sur le même jeu de données

Exécuté immédiatement après, avec une **seconde marque** et un **second créateur** qui n'ont rien à
voir avec l'affaire précédente :

| # | Vérification |
|---|---|
| **N1** | La seconde marque ne voit **aucune** donnée de la première : ni campagne, ni demande, ni conversation, ni affaire |
| **N2** | Le second créateur ne voit ni le profil identifié, ni les candidatures, ni les conversations du premier |
| **N3** | Aucun des deux ne voit **l'identité** du créateur de l'affaire, alors même que la mise en relation a été révélée à quelqu'un d'autre |
| **N4** | Un appel **non authentifié** sur chacune des routes du parcours renvoie une erreur d'authentification, jamais une donnée |
| **N5** | Un membre tente d'atteindre une route du backoffice ⇒ refus, **même code de réponse** qu'une route inexistante |

---

## 8. Ce qui n'est pas couvert, et pourquoi

Un trou connu vaut mieux qu'un faux sentiment de sécurité. Voici les miens, sans enjolivure.

| # | Non couvert | Pourquoi | Ce qui le couvre à la place, s'il existe |
|---|---|---|---|
| **1** | **Le calcul de la commission** | Il n'existe pas (A1). C'est la zone n° 1 historique du projet, et elle est **absente du MVP** | T16 vérifie son **absence**. La zone redeviendra n° 1 en V2, et ce plan devra être réécrit ce jour-là |
| **2** | **La sincérité de la saisie du commercial** | Aucun test ne dit si un montant saisi correspond à un contrat réel. Tout le pilotage du revenu en dépend (`01` §10, point 6) | Discipline d'équipe : procédure écrite, revue hebdomadaire du pipeline, intéressement sur la commission **encaissée** |
| **3** | **Le contournement hors plateforme** | Un numéro dit en visioconférence, photographié ou donné dans un salon échappe à toute technique (`01` §1, illusion n° 1) | La présence du commercial dans le fil, et rien d'autre |
| **4** | **L'accès par le tableau de bord Supabase, GitHub ou Railway** | Ces trois comptes contournent **tous** les contrôles de ce plan, sans laisser de trace dans nos journaux (S-7) | Second facteur sur les trois comptes et limitation du nombre de personnes — décision **F-3**, du ressort du fondateur |
| **5** | **La malveillance d'une personne cumulant `agent` et `admin`** | La procédure dégradée du §1.3 protège contre l'erreur, **pas contre l'abus de droit** (S-8, F-6) | Revue hebdomadaire X4, marquage `dual_control: degraded_single_operator` |
| **6** | **La délivrabilité réelle des e-mails** | Elle ne se mesure qu'en production, avec un domaine authentifié et un historique d'envoi | Surveillance du délai de délivrance (`integrateur`), et T17 garantit qu'on n'envoie rien par erreur |
| **7** | **La charge et la performance** | Volume du pilote : quelques dizaines d'affaires, quelques centaines d'événements par jour. Un test de charge coûterait plus que le risque | Deux exceptions **testées** : la concurrence de la chaîne d'audit (T3.8) et le verrou de file (TM3.1), qui sont des problèmes de correction, pas de débit. **En production, les lenteurs et les pics d'appels sont détectés par la surveillance interne, pas par un test** (**D60**, `02` §20.6) ; les tests propres à cette surveillance et une éventuelle mesure de plafond légère sur `staging` avant le premier envoi de masse sont à ajouter (`02` §20.12) |
| **8** | **L'accessibilité au-delà de l'automatisable** | Un outil détecte le contraste et les attributs manquants, pas la navigabilité réelle au clavier ni la clarté d'un libellé | **Recommandation** : contrôle automatisé sur les 5 écrans clés, bloquant sur les anomalies graves ; le reste est un **contrôle visuel** inscrit au « prêt à livrer » de chaque lot |
| **9** | **La qualité des traductions** | La parité des clés est testée, le sens des phrases ne l'est pas | Relecture humaine, inscrite au « prêt à livrer » des Lots 1 et 2 |
| **10** | **Le rappel de la détection de coordonnées** | Non garanti par construction (§6.5) | Seuils asymétriques : zéro faux positif, zéro régression |
| **11** | **La valeur juridique de la preuve** | Le registre est une preuve **auto-produite** (`01` §M4). Un test prouve sa cohérence interne, pas sa recevabilité | Cohérence avec les e-mails détenus par des tiers ; validation par un juriste |
| **12** | **La restauration des sauvegardes** | Non automatisable au MVP | **Une répétition manuelle documentée au Lot 6**, inscrite dans les procédures écrites, **puis répétée régulièrement** (fréquence fixée par `architecte` au Lot 0, **D57**) ; la restauration **à un instant donné** est testée, pas seulement la sauvegarde quotidienne. Une sauvegarde jamais restaurée n'est pas une sauvegarde |
| **13** | **Le test d'intrusion externe** | Hors de mes moyens et de mon périmètre | **F-9**, arbitrage du fondateur. Ce plan ne le remplace pas, et je ne le prétends nulle part |
| **14** | **La sécurité du poste des commerciaux** | Hors périmètre applicatif | Session de 8 h, inactivité de 30 min, re-authentification (B-7) |
| **15** | **Le rendu pixel de la vitrine** *(2026-10-28, jalon DS)* | Pas de captures de référence en CI : rendu différent entre Windows et Linux, photos, perspective 3D, halos et défilement infini de la landing, `retries: 0`, pas de cache, et le dépôt borne ses images (G4) | G3e, l'empreinte de styles calculés (TD4), un diff d'images **ponctuel** hors CI avant/après, relu par `expert-ux` |
| **16** | **Les vrais appareils** : zone de sécurité iOS, clavier virtuel qui recouvre la barre du bas, `dvh`, lecture en extérieur (`20` §8) | Playwright émule une taille d'écran, pas un système | Recette humaine (§12.4) |
| **17** | **Safari, Firefox, lecteurs d'écran, `forced-colors`, zoom 200 %, espacement du texte** | Chromium seul (A-5) ; axe ne lit pas ce qu'un lecteur annonce ; WCAG 1.4.4 et 1.4.12 ne s'automatisent pas ; le reflow à 320 px l'est (défilement horizontal) | Recette humaine (§12.4) |
| **18** | **Les états et les paires de couleurs non listés** : survol, appui, désactivé, texte d'aide, texte posé sur un fond translucide | axe ne voit pas les états, et classe en « incomplete » ce qu'il ne sait pas mélanger ; G3d ne calcule que ses paires | Matrice relue par `expert-ux` ; inventaire des « incomplete » (A-8) |
| **19** | **WCAG 1.4.1 (la couleur ne porte jamais seule) hors rôles et navigation** | Ce n'est pas une propriété du CSS | Revue `expert-ux` ; sonde TD5 pour les rôles et `aria-current` |
| **20** | **Poids et fluidité réels des polices sur 4G** : flash au `swap`, décalage de mise en page | Un plafond de 120 Ko est testé, pas une expérience ; pas de LCP ni de CLS en CI (même raison que la ligne 7) | Recette humaine sous limitation réseau |
| **21** | **Écrans d'erreur et 404 levés dans `(member)`** | Aucune page n'y appelle `notFound()` ni ne lève d'erreur aujourd'hui | Revue visuelle à la première page qui le fait (Lot 2) |
| **22** | **La connexion et l'activation du backoffice par l'interface** | Les e2e sèment des sessions déjà prouvées par TOTP (`support/backoffice.ts`) : aucun parcours mot de passe + second facteur n'est joué dans un navigateur. Au jalon DS, axe ne voit que le rendu des formulaires (connexion ; activation sans jeton valide) | `apps/api/tests/backoffice-auth.test.ts` pour la logique ; recette humaine du formulaire rhabillé (§12.4) |

---

## 9. Ce qui remonte

### 9.1 À `expert-cybersecurite` — neuf points, dont cinq demandent une décision

| # | Point | Ce que je demande |
|---|---|---|
| **C-1** | **X3 exclu de la CI.** Le rapprochement `pg_stat_statements` n'est pas déterministe ; un test instable dans une CI bloquante finit ignoré | **Confirmer** qu'X3 devient une **alerte nocturne du worker** et non un test. X1 (= T5.1) reste la garantie dure |
| **C-2** | **Le test de temps de réponse d'A-5.** Un chronomètre en CI est instable par nature | **Valider le remplacement** : assertion déterministe sur le **chemin d'exécution** (compteur d'opérations identiques), plus une mesure chronométrée **nocturne et indicative** |
| **C-3** | **T16.2, règle de proximité.** « Aucune littérale `0.35` près d'un montant » doit être définie précisément pour être implémentable sans faux positif | *Règle écrite le 2026-09-26* (T16, « Définitions ») : opérandes directs pour T16.1, même fonction et littérales décimales ou pourcentages pour T16.2. **Confirmer ou amender avant le J2** — sans règle écrite, T16 ne se code pas |
| **C-4** | **La liste des marqueurs de T1.** Elle est le cœur du test le plus important du plan | **Qui la détient et qui l'étend** quand une colonne identifiante apparaît ? Je propose que **toute migration ajoutant une colonne à `creator_identities` ou `creator_social_accounts` échoue en CI** tant que le marqueur correspondant n'est pas ajouté |
| **C-5** | **`conversation_access_log` append-only mais non chaînée** (`04` §12.1) | Mes tests T3.10 supposent l'append-only sans chaînage. **Confirmer**, sinon je dois ajouter les cas de chaîne |
| **C-6** | **T12 : seuil bloquant critique + élevée** | **Confirmer** ce seuil, et confirmer que les dérogations datées font échouer la CI à expiration (mon T12.4) |
| **C-7** | *2026-09-26.* **Une ligne d'audit par élévation** (`03` §6.7, T6.4) : le worker prend une transaction élevée à chaque tour de file (E-3) ; une ligne par tour, même à vide, écrirait des dizaines de milliers de lignes par jour sous le verrou de chaîne | **Trancher avant le J6** : une ligne par transaction élevée **qui écrit**, ou par lot pris non vide ; T6.4 suivra |
| **C-8** | *2026-09-26.* **Angle mort de F-b** : une même modification peut changer une politique **et** la ligne du fichier d'attendus de T2 qui la décrit | Étendre le contrôle du marqueur `security-reviewed:` (I-4) au fichier d'attendus de T2, en plus de `supabase/migrations/**` ; même attestation ultérieure `security-reviewed: <date> covers <sha>…` que I-4 (2026-10-08) |
| **C-9** | *2026-09-26.* **« Aucun membre » et PostgreSQL ≥ 16** : un rôle créé par un rôle non superutilisateur (`postgres` sur Supabase) est attribué d'office à son créateur, avec `ADMIN OPTION`. Les trois propriétaires de fonctions ont donc un membre, le rôle de migration | **Confirmer** la tolérance écrite en T4.3 (rôle de migration seul, `admin_option` vrai, `inherit_option` et `set_option` faux après la migration). `ALTER FUNCTION … OWNER TO` exigeant de pouvoir prendre le rôle cible, `0001` doit retirer ce droit dans la même migration — T4.3 le vérifie |

### 9.2 À `expert-conformite-rgpd` — cinq points

| # | Point | Ce que je demande |
|---|---|---|
| **G-1** | **Jeux de données de test.** Règle de ce plan : aucune donnée personnelle réelle, nulle part, y compris en `staging` (B9) | **Valider** le générateur synthétique et la règle « toute adresse de test se termine par un domaine réservé » (T17.4) |
| **G-2** | **Le corpus de détection** (§6) contient des coordonnées obfusquées **inventées**, versionnées dans le dépôt | **Confirmer** que c'est acceptable, et confirmer la règle « origine toujours synthétique, jamais observée même anonymisée » (lien avec R-6) |
| **G-3** | **TM9.3 : le registre survit à une anonymisation** | C'est le comportement que je m'apprête à **figer dans un test**. Tant que **R-1** (base légale et durée de la conservation probatoire) n'est pas tranchée, je fige peut-être un comportement illicite. **Prioritaire, Lot 1** |
| **G-4** | **Critères d'acceptation des demandes RGPD** (TM9) : que doit contenir exactement un export, et qu'est-ce qui est exclu de l'effacement (affaires, registre) | Sans ses critères, TM9.1 et TM9.2 ne sont que des intentions. **Échéance Lot 5**, mais la forme du test se décide au Lot 1 |
| **G-5** | **A7 / D33 — l'interrupteur Apollo par catégorie de profil** | Je le teste (TM1.6) **avant** qu'il ne serve. **Confirmer** que la granularité testée (catégorie de profil) est celle dont le juriste aura besoin ; si c'est par pays, il faut le dire maintenant |

### 9.3 À `architecte` — neuf points d'outillage (A-1 à A-6 au Lot 0 ; A-7 à A-9 ajoutés le 2026-10-28, jalon DS)

| # | Point | Ma recommandation |
|---|---|---|
| **A-1** | **Base jetable pour les tests de RLS** | *Tranché (`21` J2, point 7) :* pile Supabase locale, `supabase db reset` à chaque exécution, migrations appliquées avec `DIRECT_DATABASE_URL`. **Sans elle, T2, T3 et T4 n'existent pas.** *2026-09-26 :* Docker absent du poste — prérequis du J2, voir §3, « Où tournent les tests en base » |
| **A-2** | **Harnais de rôles et de transactions** | Un utilitaire partagé (`packages/test-kit` ?) qui ouvre une transaction, prend un rôle, pose le contexte, exécute, annule. Sans lui, chaque test recopie dix lignes et la suite devient illisible |
| **A-3** | **Inventaire des routes lisible par une machine** (T1.2) | Les schémas Fastify doivent être énumérables à l'exécution. C'est une contrainte d'architecture, pas un détail de test |
| **A-4** | **Durée d'exécution.** La matrice complète représente de l'ordre de 78 tables × 8 rôles × 4 opérations | Une exécution par transaction annulée, en lot, plutôt qu'un test par assertion. À dimensionner au Lot 0 : au-delà de **10 minutes**, la CI sera contournée |
| **A-5** | **Outil de bout en bout** | **Tranché (architecte, 2026-10-08) : Playwright** pour le §7. `@playwright/test` en version exacte (devDependency de `apps/web`), **Chromium seul**, `retries: 0`, serveurs démarrés par la configuration (doublure Brevo, `apps/api` depuis ses sources, `apps/web`), jamais réutilisés ; lancé en CI **après `pnpm check`**. Autre navigateur seulement sur besoin constaté |
| **A-6** | **Il n'existe aujourd'hui aucun workflow d'intégration continue** (`.github/` absent) ; la racine expose `pnpm check` | À créer au Lot 0 avec `integrateur`, avec les déclencheurs du §3 (à chaque exécution / hebdomadaire / avant déploiement) |
| **A-7** | *2026-10-28, jalon DS.* **Filet global des e2e** | Une fixture automatique dans `e2e/support/journey.ts` (`test.extend`) : toute requête hors des deux origines des fronts et toute violation de CSP font échouer le test, sauf option explicite (le test T10.6 qui en provoque une). Un seul endroit, et tous les parcours existants en bénéficient. À poser en DS-1, **avant** le premier changement : si un parcours existant n'est pas propre, c'est une trouvaille |
| **A-8** | *2026-10-28.* **Aide axe** (`e2e/support/axe.ts`) | (a) rejouer sur plusieurs largeurs **dans le même parcours** (`setViewportSize`, sans rechargement : une exécution d'axe par largeur, pas un parcours de plus) ; (b) ajouter l'étiquette `wcag22aa` (taille de cible, `axe-core` 4.13) sur les écrans rhabillés ; (c) rapporter les résultats `incomplete` de `color-contrast`, aujourd'hui ignorés (`resultTypes: ["violations"]`), avec un plafond par écran fixé à zéro après un premier inventaire au DS-4 |
| **A-9** | *2026-10-28.* **Empreinte de styles calculés de la vitrine** (TD4) | Un fichier JSON sous `apps/web/e2e/fixtures/`, jamais une image (G4) ; propriétés indépendantes des métriques de police (couleur, fond, famille **déclarée**, tailles, rayons, espacements, ombres) ; mise à jour = commit qui le dit, comme les empreintes de G5 |

### 9.4 Au fondateur — quatre points

| # | Point | Ce qu'il faut savoir pour trancher |
|---|---|---|
| **F-a** | **Le Lot 0 n'est pas livrable tant que les dix points bloquants B1 à B10 ne sont pas en place.** Je reprends à mon compte le veto de `expert-cybersecurite` : ce sont aussi mes critères de « prêt à livrer » (§10) | Aucun ne coûte plus d'une journée, tous coûtent dix fois plus après |
| **F-b** | **La dérogation « pas de Pull Request » (F-4).** Mes tests T2, T3 et T4 rattrapent beaucoup, mais **pas** une migration qui modifierait en même temps la table d'attendus et la politique qu'elle décrit | C'est le seul angle mort que la CI ne peut pas fermer seule. Je recommande de **lever la dérogation pour le seul dossier `supabase/migrations/**`** — ou, à défaut, d'accepter le marqueur `security-reviewed:` de I-4 |
| **F-c** | **D39 (délai de traitement de la file) doit être une donnée, pas une constante.** Mon test TM3.5 lit `backoffice.sla_policies` | Tant que D39 n'est pas tranchée, la table existe mais le seuil n'est pas mesuré : l'indicateur n° 3 du cadrage reste vide |
| **F-d** | **Le coût.** Écrire et maintenir cette base de tests représente de l'ordre de **15 à 20 % de l'effort de développement du MVP** | Ce n'est pas une option. Sans T1 et T2, A2 n'est qu'une intention ; sans T3, la preuve d'intermédiation n'est qu'une promesse. C'est le prix de pouvoir dire « c'est testé » plutôt que « ça devrait marcher » |

### 9.5 À `expert-database` — quatre points, pour les migrations du J2 *(ajouté le 2026-09-26)*

| # | Point | Ce que je demande |
|---|---|---|
| **D-1** | **La vérification de `04` §7.2 ne voit pas une altération du contenu** : elle compare `row_hash` à `sha256(prev_hash || payload_hash)` avec le `payload_hash` **stocké** ; un `payload` modifié sans toucher aux empreintes passe | Recalculer `payload_hash` depuis la forme canonique dans le vérificateur (T3.4, T3.5) |
| **D-2** | **La suppression des dernières lignes ne laisse aucun trou** | Ancrer la vérification sur le dernier `chain_checks` (`to_seq`, `head_row_hash`) : T3.11 |
| **D-3** | **Vocabulaire du résultat** : le vérificateur produit `broken_row`, `broken_link`, `gap` ; `chain_checks.status` n'admet que `ok`, `broken`, `gap` | Confirmer la correspondance écrite en T3 ; proposer `chain_checks` en ajout seul (T3.10) |
| **D-4** | **Jeu de données de T2** : sans ligne présente dans chaque table, la forme `filtré` ne prouve rien | Fournir, avec chaque migration du J2, le gabarit de ligne de chaque table et ses lignes du jeu de données (comptes A et B par rôle), `billing.commission_rates` exceptée |

---

## 10. La définition du « prêt à livrer », lot par lot

**Règle commune à tous les lots.** Un lot est livrable quand **toutes** les cases sont cochées, y
compris celles qui ne s'automatisent pas. Une case non cochée mais **explicitement acceptée et datée
par le fondateur** vaut cochée : c'est la différence entre un risque accepté et un risque ignoré.

**Cases communes, à tous les lots :**

- [ ] `pnpm check` vert (format, typecheck, lint, tests, build)
- [ ] Les critères d'acceptation de `product-owner` du lot sont tous vérifiés
- [ ] Aucun test instable : trois exécutions consécutives donnent le même résultat
- [ ] Les tests des lots précédents passent toujours (non-régression)
- [ ] `expert-cybersecurite` sans objection ouverte
- [ ] `expert-conformite-rgpd` sans objection ouverte si des données personnelles sont touchées
- [ ] Les cas limites identifiés sont couverts, **ou** explicitement acceptés et documentés
- [ ] **Contrôle visuel** sur les écrans livrés : dark theme, tokens, contrastes, mobile

---

### Lot 0 — Socle

> **Le Lot 0 porte les dix points bloquants de la revue de sécurité.** Aucun ne se reporte : chacun
> coûte moins d'une journée maintenant et bien davantage plus tard.

**Les dix points bloquants, chacun avec son test :**

- [ ] **B1** — Quatre rôles Postgres distincts (`influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin`), `GRANT` par rôle, `SET LOCAL ROLE` après lecture du rôle en base → **T2.1, T2.7, T4.2, T4.3, T4.8**
- [ ] **B2** — `service_role` utilisé nulle part ; liste fermée des rôles de `03` P7 (J2 : douze, dont `influx_auth_login`, `influx_worker_login` et trois propriétaires sans membre ; aucun `BYPASSRLS`), une variable par rôle de connexion (EC-20) ; liste fermée des opérations élevées → **T4.1 à T4.8, T6.1 à T6.6**
- [ ] **B3** — Aucune table métier dans `public` ; aucun schéma exposé à PostgREST ; `REVOKE ALL` sur `PUBLIC`, `anon`, `authenticated` et `service_role` → **T2.2, T2.4, T2.8**
- [ ] **B4** — Session opaque révocable, ligne en base avec `revoked_at` → **T8.7, T8.12**
- [ ] **B5** — `REVOKE SELECT` sur `messaging.messages` et `conversations` pour les rôles internes *(préparé au Lot 0, vérifié au Lot 4)* → **T5.1, T5.5**
- [ ] **B6** — Aucun droit, aucune route, aucun champ de pièce de vérification pour le rôle annonceur *(vérifié au L2E, clôture du 2026-11-08 : T9.6, 12 cas, vert trois fois ; l'annonceur sans aucun droit sur `verification`)* → **T9.6**
- [ ] **B7** — Compte administrateur de secours « bris de glace » créé, codes scellés, alerte à chaque connexion → **vérification humaine + T8.11**
- [ ] **B8** — Codes à usage unique : un seul valide, limitation à trois niveaux, réponse identique *(préparé, vérifié au Lot 1)* → **T8.1 à T8.6**
- [ ] **B9** — `staging` alimenté exclusivement par `supabase/seed`, interdiction écrite de toute restauration de production → **T17.4 + procédure**
- [ ] **B10** — `react/no-danger` en **erreur** dans les deux fronts, aucun rendu Markdown → **règle ESLint + garde**

**Tests exigibles au Lot 0 :** T2, T3, T4, T6, T11, T12, T16 — **7 familles, 49 cas** (T6.4 et T6.5 à partir du J3). **Au J2** : T2, T3, T4, T6 (T6.1 à T6.3, T6.6), T16.

**Cas avancés au Lot 0 (socle J1 à J4)**, comptés dans leur famille et complétés à son lot : T7 en
unitaire contre un faux serveur local (conditions PP) avec T7.8 à T7.12 ; T8.7, T8.12, T8.13 (J3) ;
l'enveloppe `404` / `500` et T13.5 à T13.7 ; T17.5 à T17.10 ; TM11.4.

**Autres vérifications :**

- [ ] Les gardes de `apps/web` sont **extraites dans un harnais partagé** (`packages/test-kit`, J1) et étendues aux nouveaux paquets (G3, G7) — sans quoi « étendu » reste un mot
- [ ] **G5 levée au J1, dans le commit du passe-plat, avec sa garde de remplacement** (§5, EC-13), et garde annexe réseau scindée dans le même commit. **G1, G2, G4, G6, la parité FR/EN de `apps/web` et le confinement du module fictif restent en place jusqu'au J9.** Au backoffice : G3, G7 et la garde des libellés d'EC-25 (§5, annexe 1)
- [ ] Un compte de démonstration **par rôle** se connecte réellement dans les trois espaces
- [ ] Moteur de conteneurs installé sur le poste ; T2, T3, T4 et T16 verts **en local et en CI**, aucun cas sauté (§3, « Où tournent les tests en base »)
- [ ] **Non automatisable** : sur chaque projet Supabase hébergé, aucun de nos schémas n'est exposé à l'API de données (T2.4)
- [ ] I-4 (marqueur `security-reviewed:` sur les migrations sensibles), I-5 (deux comptes ou élévation), I-7 (`x-influx-internal`), I-12 (T12 hebdomadaire) en place
- [ ] **Non automatisable** : le fondateur a tranché F-b (dérogation Pull Request sur `supabase/migrations/**`)

---

### Lot 1 — Inscription et leads ▸ première mise en ligne

**Tests exigibles :** T7, T8, T10, T13, T15, T17 + TM1, TM10 — **8 familles, 74 cas** *(68 + TM1.11
à TM1.16, 2026-10-17, D67)* (dont une partie avancée au Lot 0), plus les familles du Lot 0 en
non-régression.

*État à la clôture du J9 (revue `testeur` du 2026-10-27, sur `8323aeb`) : 6 cases cochées, 5 au
fondateur. T15.2 (routes de recherche et de profil) entre au Lot 3 : T15 passe pour .1, .3, .4, .5.*

- [x] **Aucune garde n'est levée sans son remplaçant dans le même commit** (G2 → CSP testée + garde resserrée ; G4 et G6 → gardes d'absence) — §5. G5, levée au J1, est complétée par **T7 en entier, en intégration** — *`apps/web/tests/guards.test.ts` (G2, G4, G6), e2e T10.6, `test:artifacts` (T7)*
- [x] Le module fictif, `IS_MOCKUP` et le bandeau « Maquette » **n'existent plus** dans le dépôt — *`dafb876`, garde d'absence G6*
- [x] *(reformulée à la clôture du J9, D70)* Une inscription réelle crée un compte **et** trois lignes de file (contact Brevo, contact Apollo, bienvenue) ; aucun appel sortant n'est possible en `development`, en CI ni en test (verrous 2 et 3, doublure, RG148) ; `staging` et `production` refusent de démarrer en `dry_run`, `redirect` ou avec liste blanche (T17.5 à T17.7) ; `staging` envoie pour de vrai (D70) — *`tm10-signup-route`, T17*
- [x] *(D67, reformulée à la clôture du J9)* Une inscription en `development` finit `succeeded` avec `dry_run` sur `brevo_contact` et la bienvenue ; une inscription de `staging` finit `succeeded` en réel (constaté le 2026-10-20, **à refaire** une fois `staging` rétabli, fiche J9) ; aucune ligne en échec de configuration (TM1.11 à TM1.16, `staging:check`)
- [ ] **Non automatisable** *(D67, D68, D69)* : identifiants de listes Brevo **de production** posés en variables `BREVO_LIST_ID_ADVERTISERS` et `BREVO_LIST_ID_CREATORS` du `worker` de production ; premier démarrage accepté par le contrôle de `05` RG162 ; aucun identifiant de modèle (D69) (`21` §5.8) — *fondateur*
- [x] La version de CGU acceptée est enregistrée par partie (TM10.4) — *`tm10-terms-in-force`, `tm10-signup-route`*
- [ ] **Non automatisable** : relecture humaine des textes FR et EN des pages publiques et des e-mails transactionnels — *fondateur ; points `expert-ux` du J9 commit 5 ouverts*
- [ ] **Non automatisable** : `expert-conformite-rgpd` a rendu son avis sur **A7 / D33**, et **le juriste a validé** — sans quoi la mise en ligne n'a pas lieu (R4 du cadrage)
- [ ] **Non automatisable** : documents légaux relus par un juriste, incluant la clause de non-contournement (A5), la supervision des conversations (A10) et la conservation probatoire (R-1) — *marqueurs D25 de `apps/api/legal/` ouverts*
- [ ] **Non automatisable** : SPF, DKIM, DMARC en place et vérifiés sur **les trois sous-domaines d'envoi de production** — *`staging` (`influx.cadaero.ovh`) : SPF, DKIM `brevo1`, DMARC `p=none` présents ; `p=quarantine` après le rodage*
- [x] *(reformulée à la clôture du J9, D70)* `staging` est servi en `noindex, nofollow, noarchive` (`apps/web/tests/guards.test.ts`, e2e T10), avec des données synthétiques (T17.4) ; son accessibilité publique est un risque accepté (D70)

---

### Jalon RK — Réalignement sur la référence KEO Emerald (D75) ▸ extra du MVP, avant le Lot 2 *(ajouté le 2026-10-30)*

**Tests exigibles :** TK1 à TK8 (§12.6) et gardes G3i, TK7.2 à TK7.5 (§5.1) ; TD1 à TD8 et TN1 à TN9 en
non-régression. Règles R1 à R4 de `archives/jalons/rk-fiche.md` : un rendu se prouve par un style calculé sur
l'élément réel, dans l'état concerné, sur la construction de production ; une absence est un cas à
part ; chaque phrase normative de `20` §11 a sa preuve (§12.7) ; chaque cas est vu rouge sur le parent.
Planchers relevés au RK-1, puis à chaque commit qui ajoute des tests ; aucun ne baisse.

**Automatisé, bloquant :**

- [ ] `pnpm check` puis `pnpm test:e2e` verts trois fois de suite ; ajout de durée e2e ≤ 60 s ; planchers relevés à chaque commit qui ajoute des tests, aucun ne baisse (`check-case-floors` compte un `test.fail()` comme exécuté : vérifié par `integrateur` au RK-1)
- [ ] e2e existants (`signup-nominal`, `journey-resume`, `landing-signup`, `account`, `account-data`, `backoffice.spec`, `security-headers`, `member-shell`, `charter-cascade`) verts **sans modifier leurs attendus**
- [ ] axe WCAG 2.1 AA + 2.2 AA sans violation aux largeurs de §12.2 ; aucun défilement horizontal à 320, 375 et 768 px
- [ ] **Vitrine inchangée** : G3e, TD4 et TK8.2 verts ; aucune requête tierce ni violation de CSP
- [ ] G3i (a) et (b) vertes avec leur cas négatif ; G1 à G9 jamais assouplies, sauf G8 étendue (TK7.3, TK7.4)
- [ ] Table de traçabilité `20` §11 → TK, TD, G ou recette sans ligne orpheline (§12.7, R3)

**Non automatisable (recette humaine) :**

- [ ] **Fondateur, à 1 440 et 375 px** : bouton principal (repos, survol, appui, désactivé), halo d'en-tête sans bord, titres en Manrope, carte cliquable survolée, badges, ligne de tableau survolée, plus de cadre sur le titre
- [ ] **Sur Mac** (RK-7), Safari et Chrome : avant/après de l'espace connecté, landing identique
- [ ] **Test du logo** (`20` §11.7) refait par `expert-ux`
- [ ] Revue groupée `testeur` + `expert-cybersecurite` faite (D71 : non bloquante sur `main`, exigée avant `production`) ; `21` § Jalon RK à jour

Non couvert, accepté : le rendu perçu (intensité, beauté), Safari et Firefox en automatique (e2e Chromium
seul), le survol tactile, un `p` stylé en titre hors `h1`–`h4`.

### Jalon SN — Sous-navigation dans la colonne (D74) ▸ extra du MVP, avant le Lot 2 *(ajouté le 2026-10-29)*

**Tests exigibles et critère de fin :** famille **TN1 à TN9** et cases du critère de fin de
`archives/jalons/sn-fiche.md` ; familles TD1 à TD8 du jalon DS en non-régression (un seul repère de
navigation, un seul `aria-current`, axe aux largeurs de §12.2). Aucun plancher ne baisse.

### Jalon DS — Charte KEO Emerald (D73) ▸ extra du MVP, entre le Lot 1 et le Lot 2 *(ajouté le 2026-10-28)*

**Tests exigibles :** TD1 à TD8 (§12), plus les familles des lots précédents en non-régression.
Planchers de départ, mesurés au parent de DS-1 : web **203**, backoffice **62**, test-kit **134**,
e2e **56** (7 fichiers) ; `apps/api` (unitaire et base) inchangé. Aucun plancher ne baisse.

**Automatisé, bloquant :**

- [x] `pnpm check` puis `pnpm test:e2e` verts, trois exécutions consécutives identiques ; durée du pas e2e mesurée avant/après (ajout ≤ 90 s, plafond du pas : 5 minutes)
- [x] Gardes G3, G3b, G3c, G3d, G3e, G3f, G3g, G4f, G8, G9 vertes, **chacune avec son auto-test** (TD1) ; G1 à G7 et annexes inchangées, aucune assouplie sans remplaçant dans le même commit (§5)
- [x] **Vitrine inchangée** : G3e, empreinte TD4 et sonde de cascade côté vitrine verts **sans modifier leurs fixtures** (toute modification = commit qui nomme les valeurs et la raison)
- [x] **Cascade** (TD3, build de production) : sur `/fr/connexion`, `/en/sign-in`, une page membre avec session et la connexion du backoffice, les `--color-*` calculés du conteneur KEO égalent les valeurs effectives lues par le lecteur ; sur `/fr` et `/en`, ils égalent l'instantané de la vitrine ; `[data-theme="keo"]` : un sur les espaces connectés, zéro sur la landing
- [x] **Polices** : landing sans fichier `woff2` ni `preload` de police ; page membre et backoffice : deux fichiers `latin` préchargés, ≤ 120 Ko, même origine ; `latin-ext` jamais téléchargé sur un contenu FR, téléchargé quand l'un de ses caractères s'affiche (sinon repli `latin` seul, consigné en écart) ; chiffres tabulaires de Manrope vérifiés
- [x] **Aucune requête tierce, aucune violation de CSP** dans aucun e2e (A-7) ; `src/config/security-headers.ts` des deux fronts et les attendus de `security-headers.spec.ts` inchangés (`git diff` vide, sauf des chemins ajoutés en T10.6)
- [x] **axe WCAG 2.1 AA + `wcag22aa`**, zéro violation et zéro « incomplete » de contraste non justifié, sur chaque écran rhabillé, aux largeurs de la matrice §12.2 ; reflow : aucun défilement horizontal de page à 320, 375 et 768 px
- [x] **Contraste par le calcul (G3d, paires relues par `expert-ux`) et par axe**, et la sonde de cascade prouve que le navigateur applique les valeurs calculées
- [x] **Clavier** (375 et 1440) : premier `Tab` = lien d'évitement visible, `Entrée` met le focus dans `main` ; ordre déclaré ; anneau de focus visible sur chaque élément focalisable des nouvelles surfaces ; focus jamais masqué par la barre du bas ni l'en-tête collant ; après une navigation cliente, focus sur le `h1`
- [x] **Navigation** : un seul repère `navigation` « Navigation principale » / « Main navigation », noms de repères tous distincts, un seul `aria-current="page"` ; barre en bas à 1023 px, colonne à gauche à 1024 px ; dernier élément de `main` jamais sous la barre
- [x] **`prefers-reduced-motion`** émulé : durées de transition nulles sur les éléments interactifs de la coquille, aucune animation infinie en cours
- [x] **Session** : la coquille relit la session à chaque navigation cliente (CGU publiées en cours de session, session fermée ailleurs, bandeaux du backoffice) ; « compte supprimé » et « déconnecté » sans navigation
- [x] **FR/EN** : parité des clés (nouveau fichier de traduction compris), libellés de navigation ≤ limite arbitrée (11 ou 12), lus dans les fichiers ; parcours existants verts en FR et en EN
- [x] **Non-régression à chaque commit DS** : `signup-nominal` (2), `journey-resume` (7), `landing-signup` (4), `account` (5), `account-data` (1), `backoffice.spec` (9), `security-headers.spec` (28), **sans modifier leurs attendus** hors les exceptions écrites au §12.3 ; aucun test supprimé
- [x] **Logique intacte** : aucun changement aux tests de `auth-steps`, `signup-form`, `journey-memory`, `account-view`, `view-model`, `ops-view-model` ; règles de la coquille (`member-nav`, `member-paths`, navigation du backoffice) testées seules

**Non automatisable (recette humaine, §12.4) :**

- [ ] **Lecture en extérieur**, écrans créateur, sur un vrai téléphone (`20` §8) : verdict écrit de `expert-ux` et `testeur`
- [ ] **Test du logo** (`20` §11.7) : une capture par gabarit, logo masqué, deux personnes extérieures au projet
- [ ] Passe clavier, lecteur d'écran (VoiceOver iOS, NVDA), zoom 200 % et 400 %, `forced-colors`
- [ ] iPhone (zone de sécurité, clavier), Android sous limitation réseau (polices), iPad en portrait
- [ ] Le fondateur valide les trois gabarits contre la maquette KEO, écart par écart (K1 à K23 de `20` §11.6)
- [ ] `expert-cybersecurite` : revue groupée de fin de jalon (D71) ; marqueur `security-reviewed:` exigé avant `production`, non bloquant sur `main`
- [ ] `expert-conformite-rgpd` : sans objet (aucune donnée personnelle nouvelle) tant qu'aucun stockage ni cookie n'est ajouté (garde annexe 2) ; un repli de colonne mémorisé le rouvrirait (`02` §21.5 point 5)

---

### Lot 2 — Profils, réseaux, audience, badge

**Tests exigibles :** T1, T9, T14 + TM5 (partiel), TM11 — **5 familles, 31 cas.**

- [ ] **T1 passe intégralement** : c'est le lot où l'anonymisation devient réelle, et le lot où elle peut fuir pour la première fois
- [ ] **T9.6 passe** : aucune pièce de vérification atteignable par un annonceur, y compris en devinant un identifiant
- [ ] T9.5 : métadonnées EXIF effectivement absentes après traitement (I-1)
- [ ] TM12.6 : l'alias public est aléatoire (I-2)
- [ ] I-10 : écran « mes sessions actives » livré
- [ ] **Non automatisable** : `expert-conformite-rgpd` a tranché **R-4** (vocabulaire : un profil « anonymisé » reste une donnée personnelle) et **R-5** (pièces de vérification contenant des données de tiers)
- [x] **Non automatisable** : le fondateur a tranché **D40** (2026-09-18) et sa portée après l'ouverture, **D46** (2026-09-24) : aucune coordonnée directe servie à un membre, testée par T1.6
- [ ] **Non automatisable** : revue visuelle de dix visuels de portfolio modérés — la modération est la fuite d'anonymisation la plus probable du produit
- [x] **TM5 (partiel) : TM5.3 et TM5.4 tenus au L2F**, cochés à la clôture de L2F le 2026-11-11 (verts trois fois, CI réelle `success` sur `988388e`) ; le reste de TM5 suit son lot *(noté le 2026-11-10, L2F-16)*. TM5.3 : `db-tests/verification-lifecycle.test.ts` (la tâche seule, événement système ; aucune autre main, écriture directe d'un agent, d'un administrateur ou d'un membre et appel de la tâche par un agent refusés). TM5.4 : `db-tests/verification-revocation.test.ts`, et par route `t14-verification-badges-route.test.ts`. Deux mutations vues rouges : la tâche exécutée par un agent (ligne du registre `agent`), le retrait sans consommation de la 2V. TM5.5 (modération du profil) reste à L2G ; TM5.1, TM5.2 et TM5.6 au Lot 3. Au même commit : T9.6 nomme les sept tables du L2F ; T1 porte quatre marqueurs de plus (ancien et nouveau handle, texte de contestation, message de retrait) et cherche ces marqueurs dans `audit`, `ops` et `leads` (C-2) ; TM11 vérifie que les déclarations Drizzle dont il dérive sa liste sont celles de la base (`db-tests/tm11-drizzle-parity.test.ts`)

---

### Lot 3 — Campagnes et recherche anonymisée

**Tests exigibles :** T1 (rejoué sur les routes de recherche), T14, T15 + TM5, TM12 — **5 familles,
28 cas.**

- [ ] TM12.1 à TM12.5 : k-anonymat, pagination plafonnée, **export interdit à tout le monde**, recherches journalisées, vue identifiée refusée aux membres
- [ ] I-9 : alerte sur un volume anormal de profils distincts consultés par un même compte sur 24 h
- [ ] **Non automatisable** : le fondateur a tranché **D38** (masse critique de profils avant d'ouvrir la recherche)
- [ ] **Non automatisable** : la recherche en vue identifiée permet au commercial de trouver les bons créateurs d'une campagne **en moins de 30 secondes** — mesuré à la main, sur trois campagnes réelles. C'est la valeur annoncée du lot ; si elle n'est pas là, le lot n'est pas livré

---

### Lot 4 — Mise en relation courtée et messagerie à trois

**Tests exigibles :** T1, T5, T14 + TM2, TM3, TM7 — **6 familles, 35 cas**, plus le corpus de
détection.

- [ ] **T5.1 passe** : aucun chemin de lecture des messages hors de la fonction journalisante. C'est la première chose que `expert-cybersecurite` vérifiera
- [ ] **TM2.1 et TM2.2 passent** : la révélation est atomique, elle produit exactement les cinq effets attendus
- [ ] TM2.3 : `identity_revealed_at` est write-once, y compris pour `admin`
- [ ] TM3.1 : deux commerciaux ne peuvent pas traiter la même demande
- [ ] Le corpus de détection (§6) existe, ses seuils bloquants passent, le rappel est **mesuré et consigné**
- [ ] I-3 : empreinte de tête de la chaîne publiée hors de la base
- [ ] I-11 : contrôle croisé X3 (nocturne) et revue X4 (hebdomadaire) en place
- [ ] **Non automatisable** : le fondateur a tranché **D39** (délai de traitement de la file), et le délai est **mesuré et affiché** au tableau de bord dès le premier jour
- [ ] **Non automatisable** : **D30** tranchée (politique de signalement des coordonnées), y compris le traitement des cas N2 et N3 de la liste blanche (§6.4)
- [ ] **Non automatisable** : un commercial ouvre cinq mises en relation par proposition INFLUX **en moins de temps qu'un appel téléphonique** — mesuré à la main. Si ce n'est pas le cas, les commerciaux reprendront leur téléphone et le lot a échoué

---

### Lot 5 — Backoffice complet, pipeline commercial et e-mails

**Tests exigibles :** T14 + TM4, TM6, TM8, TM9 — **5 familles, 32 cas.**

- [ ] TM4.2 : **chaque transition illégale échoue**, exhaustivement
- [ ] TM6.6 : toute modification de montant écrit une ligne d'historique, **écrite par le déclencheur**
- [ ] TM8 : les trois sources d'e-mails et leurs trois bases légales sont distinctes et testées
- [ ] X4 : l'écran de revue hebdomadaire des lectures de conversations existe
- [ ] La revue hebdomadaire des actions en mode dégradé (PD6) est affichée au tableau de bord
- [ ] **Non automatisable** : **D35** tranchée (plafonds de la saisie libre), avec l'accord de `expert-conformite-rgpd` — **veto**
- [ ] **Non automatisable** : **D36** tranchée (langue du backoffice)
- [ ] **Non automatisable** : `expert-conformite-rgpd` a validé **R-7** (exécution des demandes RGPD) — sans quoi TM9 teste un comportement non validé

---

### Lot 6 — Recette, audit, ouverture

**Tests exigibles :** **toutes** les familles, plus le parcours de bout en bout du §7.

- [ ] Les 29 familles passent, soit 211 cas (D67), en une seule exécution de CI
- [ ] Le parcours de bout en bout (12 étapes) et le parcours négatif (5 vérifications) passent
- [ ] La vérification complète de la chaîne d'audit renvoie `ok` sur la totalité du registre
- [ ] `billing.commission_rates` est **toujours vide** (T16.3) — c'est le dernier contrôle avant ouverture
- [ ] Aucune dérogation de dépendance expirée (T12.4)
- [ ] **Non automatisable** : **audit de sécurité** de `expert-cybersecurite`, veto levé par écrit
- [ ] **Non automatisable** : **audit de conformité** de `expert-conformite-rgpd`, veto levé par écrit
- [ ] **Non automatisable** : **test d'intrusion externe** (F-9) réalisé, ou risque **explicitement accepté et daté** par le fondateur
- [ ] **Non automatisable** : **restauration d'une sauvegarde répétée une fois**, chronométrée, documentée. Une sauvegarde jamais restaurée n'est pas une sauvegarde
- [ ] **Non automatisable** : procédures écrites permettant à un nouveau commercial de prendre le poste, relues par quelqu'un qui n'a pas participé au projet
- [ ] **Non automatisable** : **mise en production sur accord explicite du fondateur**, jamais à l'initiative d'un agent

---

## 11. Verdict

**Suis-je en mesure de déclarer un lot « prêt à livrer » aujourd'hui ? Non — aucun lot n'a commencé.**
Ce document est l'instrument de mesure, pas la mesure.

Ce que je peux dire dès maintenant :

| Question | Réponse |
|---|---|
| Le plan couvre-t-il les exigences de `expert-cybersecurite` ? | **Oui** : T1 à T17 repris un par un, X1 et X2 devenus des tests de CI, X3 et X4 explicitement sortis de la CI avec justification (§9.1, C-1) |
| Une protection disparaît-elle avec les gardes levées ? | **Non**, à une condition de calendrier : une garde n'est levée que dans le commit qui introduit son remplaçant (§5) |
| Le plan est-il proportionné ? | **211 cas (D67), 29 familles, un seul parcours de bout en bout.** Peu de tests, tous choisis. Le coût d'entretien a été un critère de sélection au même titre que la couverture |
| Reste-t-il des zones non couvertes ? | **Quatorze**, listées au §8 (plus huit du jalon DS, lignes 15 à 22, *ajoutées le 2026-10-28*). Quatre d'entre elles (le tableau de bord Supabase, la malveillance d'un opérateur unique, le test d'intrusion, la sincérité de la saisie) ne relèvent d'aucun test et remontent au fondateur |

**Le point sur lequel je ne transigerai pas :** tant que **T1**, **T2**, **T3** et **T4** ne passent
pas, aucune affirmation de ce projet sur l'anonymisation ou sur la preuve d'intermédiation n'est
vérifiée. Ce sont quatre tests, ils appartiennent tous au Lot 0 ou au Lot 2, et ils portent à eux
seuls les deux zones critiques n° 1 et n° 2.

---

## 12. Les tests du jalon DS, charte KEO Emerald (D73) *(ajouté le 2026-10-28)*

**Sources :** `02` §21 (mécanique), `20` §11 (charte, contrastes, composants), `17` §2.2 et §2.3,
`17b` §1. **Niveaux :** unitaire et gardes pour les règles pures ; e2e Playwright, sur le build de
production, pour ce qu'un navigateur seul prouve. Aucun service externe ; les sessions sont semées
(`seedMember`), un parcours d'inscription ne sert que lorsqu'il s'agit d'inscription. Les e2e du
backoffice entrent dans `backoffice.spec.ts` (sériel, seul fichier qui sème un administrateur,
`playwright.config.ts`). Tout nouveau fichier de test reçoit son plancher (`check-case-floors`).

### 12.1 Les familles TD1 à TD8, 44 cas

| Famille | Niveau | Cas |
|---|---|---|
| **TD1 — Lecteurs et gardes du jalon** (12) | Unitaire, `packages/test-kit/tests`, **auto-tests** | **TD1.1** bloc KEO absent, dupliqué ou hors `tokens.css` détecté · **TD1.2** valeur effective par charte (bloc KEO, sinon `@theme`, sinon `:root`), alias suivis, cycle et cible absente en erreur · **TD1.3** fermeture des alias : alias direct, alias à deux niveaux, `calc(var(…))` non redéclaré détectés ; redéclaré à l'identique accepté ; redéclaré vers une autre cible détecté · **TD1.4** lecteur insensible aux commentaires (accolades, `--x:` en commentaire), au CSS sur une ligne, aux sauts de ligne Windows · **TD1.5** `rgba(`, `color-mix(`, `!important`, nom absent de `@theme` (faute de frappe) dans le bloc détectés · **TD1.6** `--color-*` ni redéfini, ni dans `KEO_INHERITS`, ni dans `VITRINE_ONLY` détecté ; entrée périmée détectée · **TD1.7** écart de teinte, **seuil passé en paramètre** (la fonction n'écrit aucun 20 en dur) : `#2dd4bf` / `#1dd68a` = 17,0°, `#3ccfcf` = 24,6°, `#4ade80` = 13,5°, chacun comparé à un seuil de 20° puis de 15° ; gris sans teinte refusé ; passage par 0° (350° et 10° = 20°) · **TD1.8** une paire sous le seuil **dans le bloc KEO** échoue alors que la même paire passe en vitrine (le lecteur lit le bon bloc) · **TD1.9** manifeste de polices : SHA-256 modifié, fichier non listé, fichier listé absent, signature ≠ `wOF2`, licence absente, copies divergentes, budget dépassé · **TD1.10** G8 : `data-theme` ou `fonts.ts` hors des deux mises en page, `createPortal`, module de la vitrine sous `(member)`, transformation d'état, `transition-all`, page de `MEMBER_PAGE_SLUGS` hors de `(member)` · **TD1.11** G3g : classe de rôle hors du composant autorisé, composant sans libellé · **TD1.12** G9 : lecture de session importée hors d'une coquille, chaîne correcte acceptée |
| **TD2 — Règles de navigation** (8) | Unitaire, `apps/web/tests/member-nav.test.ts`, `apps/backoffice/tests` | **TD2.1** cinq entrées au plus par rôle, ordre fixe (`17` §2.1) · **TD2.2** libellé ≤ limite arbitrée (11 ou 12), FR **et** EN, lu dans les fichiers de traduction (« Candidatures », 12, échoue à 11) · **TD2.3** chaque entrée visible mène à une page existante, FR et EN : aucun lien mort ; une entrée sans écran est absente ou « bientôt » sans lien · **TD2.4** entrée active : chaque page de `MEMBER_PAGE_SLUGS` dans les deux langues, sous-pages de « Mon compte » comprises ; chemin inconnu, aucune · **TD2.5** espace exigé par chemin : l'espace marque est refusé à un créateur et inversement, avec renvoi à son accueil (`05` RG66) · **TD2.6** pages exemptées de l'écran des CGU = `TERMS_EXEMPT_PAGES`, et elles seules · **TD2.7** backoffice : un `agent` n'a aucune entrée d'administration, un `admin` a les sept, ordre fixe · **TD2.8** backoffice : entrée active pour chaque adresse (`/inscrits/[id]`, `/double-validation/[id]`, `/reglages/apollo` comprises) |
| **TD3 — Cascade des chartes et polices** (6) | E2E, `e2e/charter-cascade.spec.ts` | **TD3.1** pages membres (`/fr/connexion`, `/en/sign-in`, accueil avec session) : un seul `[data-theme="keo"]` ; chaque `--color-*` de `@theme`, lu sur le conteneur, égale la valeur effective KEO (lecteur du test-kit sur le même `tokens.css`) : **un alias resté vitrine échoue ici même si G3c passe** · **TD3.2** backoffice (`/`, accueil avec session) : `html[data-theme="keo"]`, mêmes égalités · **TD3.3** `/fr` et `/en` : aucun `[data-theme]`, chaque `--color-*` égale l'instantané vitrine · **TD3.4** polices : landing sans `woff2` ni `link[rel=preload][as=font]` ; page membre et backoffice : deux fichiers `latin`, même origine, somme ≤ 120 Ko ; `latin-ext` non servi sur un contenu FR, servi quand un « ł » s'affiche (repli `latin` seul : attendu inverse, consigné) · **TD3.5** chiffres tabulaires : « 1111 » et « 8888 » de même largeur (à 0,01 px près) en `font-display` + `tabular-nums` une fois la police chargée · **TD3.6** le voile du dialogue des CGU (`::backdrop`) n'est pas transparent, et le dialogue reste descendant du conteneur KEO |
| **TD4 — Vitrine inchangée** (4) | G3e + e2e, `e2e/vitrine-unchanged.spec.ts` | **TD4.1** G3e : chaque déclaration de `vitrine-tokens-d59.json` reste égale (ajouts permis) · **TD4.2** empreinte de styles calculés de `/fr` et `/en` à 375 et 1440 (en-tête, `h1`, boutons d'appel, une carte, une section, pied de page) égale à `e2e/fixtures/vitrine-computed-styles.json`, **prise sur le parent de DS-1** : elle voit un composant partagé ou `globals.css` modifié, que G3e ne voit pas (rayon, graisse 500, contour de 2 px du bouton secondaire) · **TD4.3** `html` et `body` de la landing : mêmes classes et même `font-family` déclarée · **TD4.4** frontière : chaque page de la liste de `02` §21.2 porte ou non `data-theme`, liste en données dans un seul endroit (à jour de l'arbitrage sur les pages légales, §12.5) |
| **TD5 — Coquille membre** (8) | E2E, `e2e/member-shell.spec.ts`, session semée | **TD5.1** à 375, 768, 1023, 1024 et 1440 : un seul repère `navigation` « Navigation principale » / « Main navigation », noms de tous les repères distincts, un seul `aria-current="page"`, un seul `<nav>` dans le DOM · **TD5.2** à 1023 px la navigation est collée au bas de la fenêtre, à 1024 px elle est à gauche sur toute la hauteur ; le dernier élément de `main` n'est jamais sous la barre (défilé au bas, 375 et 768) · **TD5.3** premier `Tab` = lien d'évitement visible, `Entrée` met le focus dans `main`, ordre évitement → en-tête → navigation → contenu, `Maj+Tab` revient · **TD5.4** sur chaque élément focalisable (375 et 1440) : anneau visible (contour ≥ 2 px) et jamais masqué (`elementFromPoint` au centre) par la barre du bas ni l'en-tête collant · **TD5.5** après une navigation cliente par la coquille, le focus est sur le `h1` · **TD5.6** session relue à chaque navigation cliente : (a) des CGU publiées en cours de session font apparaître l'écran bloquant au clic suivant, sans rechargement ; (b) une session fermée ailleurs mène à la connexion au clic suivant ; (c) « compte supprimé » n'a aucun repère `navigation` · **TD5.7** mouvement réduit émulé : `transition-duration` nulle sur les éléments interactifs de la coquille, aucune animation infinie (`document.getAnimations()`), aucune transformation au survol · **TD5.8** sonde P7 : tout élément peint d'une couleur de rôle (valeur du jeton lue sur le conteneur) porte le rôle écrit dans son voisinage ; l'entrée active porte `aria-current` **et** une graisse supérieure à l'inactive |
| **TD6 — Coquille backoffice** (5) | E2E, dans `backoffice.spec.ts` | **TD6.1** un seul repère `navigation` ; un `agent` sans entrée d'administration (CA63 inchangé) ; lien d'évitement ; focus sur le `h1` après navigation · **TD6.2** rail à gauche à partir de 1024 px ; de 768 à 1023 px navigation compacte (un seul `<nav>`, tous les liens accessibles) ; sous 768 px de large, et à 1024 × 499 (fenêtre basse) comme à 844 × 390 (téléphone en paysage), l'écran « poste de travail » (`17b` M4, F7), sans tableau ni donnée métier ; à 1024 × 500, backoffice complet ; aucun défilement horizontal de page à 768 et 375 ; un tableau dense défile dans sa région, atteignable au clavier. Seuils lus dans les tokens, à 767/768 et 1023/1024 px (§12.5, point 5) · **TD6.3** bandeaux relus à chaque navigation cliente : « contrôle par les pairs indisponible » apparaît après un changement en base, sans rechargement ; bandeau d'environnement toujours écrit · **TD6.4** sans session, un clic de navigation renvoie à `/` ; après « Se déconnecter » : écran « déconnecté », focus sur le `h1`, aucune navigation · **TD6.5** chaque cellule de statut de la liste des inscrits porte son statut en texte (P7) |
| **TD7 — Accessibilité des écrans rhabillés** | E2E, axe, étendu aux specs existantes | Matrice §12.2. Tout écran rhabillé : zéro violation WCAG 2.1 AA et `wcag22aa`, zéro « incomplete » de contraste non justifié |
| **TD8 — Filet global** (1) | E2E, fixture automatique (A-7) | **TD8.1** toute requête hors des origines des fronts et toute violation de CSP font échouer **tout** e2e (sauf l'option explicite de T10.6) |

### 12.2 Matrice axe : largeurs par écran

Une exécution d'axe par largeur **dans le même parcours** (`setViewportSize`, A-8) : le coût d'une
largeur de plus est une exécution, pas un parcours. Quatre largeurs partout coûterait ~70 exécutions
pour peu de gain (le contraste ne dépend pas de la largeur ; la mise en page change à 1024 px) :
**quatre largeurs sur un écran représentatif par gabarit, deux ailleurs.** Chaque écran en FR ; en EN :
les deux accueils, un écran de « Mon compte » et les détails d'inscription (libellés les plus longs).
Formulaires : état par défaut **et** état d'erreur (soumission vide). Reflow (aucun défilement
horizontal de page) vérifié en plus à 320 px sur les écrans membres.

| Écran | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Parcours : connexion (e-mail, code, code non reçu), choix de porte, succès d'inscription, dialogue des CGU ouvert | ✓ | – | – | ✓ |
| Parcours : détails d'inscription marque et créateur *(représentatif du parcours)* | ✓ | ✓ | – | ✓ |
| Accueil marque, CGU en attente | ✓ | – | – | ✓ |
| Accueil créateur, compte neuf *(représentatif de la coquille)* | ✓ | ✓ | ✓ | ✓ |
| Mon compte : informations, préférences, sessions | ✓ | – | – | ✓ |
| Mes données, zone de danger, suppression *(page la plus longue)* | ✓ | ✓ | ✓ | ✓ |
| Déconnecté, compte supprimé, 404 membre | ✓ | – | – | ✓ |
| Backoffice : connexion, activation, déconnecté | ✓ | ✓ | – | ✓ |
| Backoffice : accueil, fiche d'inscrit, invitations, double validation (liste, détail, mode différé), réglages Apollo, comptes internes, santé technique | – | – | ✓ | ✓ |
| Backoffice : liste des inscrits *(représentatif)*. À 375 : l'écran « poste de travail » ; à 768 : navigation compacte (disposition en cours chez `expert-ux`) | ✓ | ✓ | ✓ | ✓ |

### 12.3 Plan par commit

> **Numérotation** : celle de `archives/jalons/ds-fiche.md` (recalée le 2026-10-28 : DS-11 = connexion et
> activation du backoffice, DS-12 = écrans d'exploitation) ; la règle suit la **nature** du commit. **Avant chaque commit** : vérification par paliers de `CLAUDE.md` §7 règle 5, et `pnpm test:e2e` pour
> tout commit qui touche un écran.

| Commit | Ce qui le prouve | E2E existants qui doivent rester verts |
|---|---|---|
| **DS-1 Filet** | Posé sur le code **inchangé**, tout vert avant le premier changement, sinon le filet est faux : lecteurs et auto-tests (TD1.1 à TD1.8), instantané G3e (pris ici), empreinte TD4.2 et TD4.3 (prise ici), filet global TD8, planchers relevés aux effectifs mesurés | tous |
| **DS-2 Bloc KEO** | G3, G3b (par charte), G3c, G3d, squelette de G3f ; décisions §12.5 points 1 et 2 prises. Rien n'est activé : aucun rendu ne change | tous ; G3e et TD4 prouvent la vitrine |
| **DS-3 Polices** | G4f (TD1.9), ESLint, budget relevé et figé. `fonts.ts` n'est importé par personne : zéro changement de rendu, et TD3.4 (landing sans police) le prouve | `security-headers` (T10.6) |
| **DS-4 Activation web** | Groupe `(member)`, conteneur, polices : G8 (TD1.10), TD3.1, TD3.3 à TD3.6, TD4.4, T10.6 étendu (`/fr/connexion`, accueil avec session), inventaire des « incomplete ». **L'axe existant à 375 devient le vrai filet** (contrastes KEO) : un échec se corrige dans les jetons, jamais en desserrant le test | `signup-nominal`, `journey-resume`, `landing-signup`, `account`, `account-data`, `security-headers` : toutes les pages ont changé de charte |
| **DS-5 Primitives** | G3g, G3h, G8 (transformation d'état sous `motion-safe:` seulement, F6), TD5.4 sur le parcours à 375, axe en état d'erreur. **Primitives partagées avec la landing** : TD4.2 reste vert sans toucher à la fixture | `signup-nominal`, `journey-resume`, `landing-signup`, `account*` |
| **DS-6 Coquille membre** | TD2.1 à TD2.6, G9, TD5.1 à TD5.8, parité FR/EN amendée (liste de fichiers), axe sur quatre largeurs (accueil créateur) | `account` (navigation du compte absente aux CGU), `account-data` (aucune navigation à « compte supprimé »), `signup-nominal`, `journey-resume` (le sélecteur de langue garde son repère `navigation`) |
| **DS-7 Parcours** | Axe 375/768/1440 selon §12.2, états d'erreur, dialogue des CGU (focus piégé, `Échap`, TD3.6), reflow à 320 px | `signup-nominal` (2), `journey-resume` (7), `landing-signup` (4) ; tests de `auth-steps`, `signup-form`, `journey-memory` **non modifiés** |
| **DS-8 Accueils et compte** | Axe §12.2 (quatre largeurs sur « Mes données »), accueil neuf sans « 0 » factice, couleurs D72 de la zone de danger | `account` (5), `account-data` (1) ; `account-view.test` non modifié |
| **DS-9 Backoffice : charte** | G3 backoffice, G3f, G4f côté backoffice, copies identiques, TD3.2, TD3.4 côté backoffice | `backoffice.spec` (9), `security-headers` (T10.2, T10.4, 404 du backoffice) |
| **DS-10 Coquille backoffice** | TD2.7, TD2.8, TD6.1 à TD6.4, G9 côté backoffice, axe 1024/1440 sur l'accueil | `backoffice.spec` : CA56 à CA63, PD1 à PD7 (bandeaux), J8T-7, D54 ; `view-model` non modifié |
| **DS-11 Connexion et erreurs du backoffice** | Axe 375/768/1440, focus, 404 et déconnexion en KEO ; mot de passe, TOTP et codes de secours inchangés | `backoffice.spec`, `security-headers` (404 du backoffice) |
| **DS-12 Écrans d'exploitation** (scindable 12a / 12b) | Axe 1024/1440 sur les huit écrans avec `wcag22aa` (lignes de 36 px), TD6.2, TD6.5 | `backoffice.spec` J8T-4 (axe sur six écrans) ; `ops-view-model.test` non modifié |
| **DS-13 Clôture** | Matrice §12.2 complète en une exécution, trois exécutions consécutives, planchers consignés, mesures (poids des polices, durée du pas e2e), diff d'images ponctuel avant/après, revue groupée `testeur` + `expert-cybersecurite`, recette §12.4 | tous |

**Attendus existants dont dépend le jalon** (ils se lisent avant de rhabiller, ils ne se desserrent pas) :
`account-data.spec.ts` lit trois couleurs D72 en dur (`rgb(229, 72, 77)`, `rgb(236, 93, 94)`,
`rgb(185, 44, 44)`) : vraies tant que `KEO_INHERITS` garde les rouges (`20` §11.3 : oui) ; si elles
changent, le commit lit le jeton au lieu de la valeur. `account.spec.ts` (navigation du compte absente à
l'écran des CGU) et `account-data.spec.ts` (aucun `navigation` à « compte supprimé ») fixent un
comportement de la coquille. `journey.ts` (`switchLanguage`) dépend du repère `navigation` du sélecteur
de langue. `title(page)` est `locator("h1")` : un seul `h1` par page.

### 12.4 Recette humaine de fin de jalon

| Qui | Quoi | Sur quoi | Critère |
|---|---|---|---|
| `expert-ux` + `testeur` | **Lecture en extérieur** des écrans créateur (`20` §8) : texte tertiaire, contour des champs, item actif de la barre | Un vrai téléphone, plein jour, luminosité automatique | Verdict écrit : lisible sans abri, ou liste des éléments à relever |
| `expert-ux` | **Test du logo** (`20` §11.7) : une capture par gabarit (membre mobile, membre desktop, backoffice), logo masqué | Deux personnes extérieures au projet | Aucune ne cite Spotify en premier ; sinon on retire un effet, jamais une couleur |
| `testeur` | **Clavier seul** sur les trois gabarits ; **lecteur d'écran** : barre du bas, lien d'évitement, focus au `h1`, `aria-current`, pastille « 9+ » lue en texte | VoiceOver iOS, NVDA (Chrome ou Firefox) | Chaque tâche de `17` §3 et §6 réalisable ; un seul repère de navigation annoncé |
| `testeur` | **Zoom 200 % et 400 %**, texte agrandi du système, `forced-colors` | Bureau et Android | Rien de rogné ni de superposé ; l'item actif reste distinguable |
| `testeur` + `expert-ux` | **iPhone** : zone de sécurité sous la barre, clavier virtuel qui ne recouvre ni le champ ni le bouton ; **iPad** en portrait (768 px, pas de colonne) ; **Android** sous « 4G lente » : flash au `swap`, décalage de mise en page | Appareils réels | Aucun libellé de barre masqué ; pas de saut visible |
| `expert-ux` | **Passage landing, porte, inscription** : deux verts, deux polices, une rupture de charte qui doit se lire comme un choix (`20` §11.1) | Mobile et bureau | Verdict écrit |
| `expert-ux` | **Glyphes hors police** (`⚑`, `○`, `→`, `✓`) : rendus par le repli système, parfois en émoji | iOS, Android, Windows | Aucun rendu qui change le sens (`20` §11.6, K6) |
| `expert-ux` | **Backoffice** : densité (lignes de 36 px), bannières, rail, huit heures de lecture | 1440×900, 1366×768, 1280×720 | Revue écrite |
| Fondateur | **Les trois gabarits contre la maquette KEO**, écart par écart (K1 à K23) ; « menu à gauche façon Railway » | Poste et téléphone | Accord écrit, ou écarts nommés |

Ce qui reste hors de portée est au §8, lignes 15 à 22.

### 12.5 Points à arbitrer qui conditionnent des tests *(relevés le 2026-10-28)*

Réponses du `chef-de-projet` (2026-10-28), reportées dans `02` §21.5 et `archives/jalons/ds-fiche.md` § « Arbitrages
appliqués » ; le point 1 est tranché par `expert-ux` ; F1, F2, F3 et F6 sont tranchés par le fondateur (2026-10-29), F7 reste ouvert.

| # | Conflit entre les documents | Test touché | Avant |
|---|---|---|---|
| 1 | **Teinte du succès** : `20` §11.3 retenait `#2dd4bf` (17,0° du vert d'action `#1dd68a`), `02` §21.8 exige ≥ 20° ; `expert-ux` ajuste (peut-être `#3ccfcf`, 24,6°). G3d lit `SUCCESS_MIN_HUE_GAP` et ses paires dans un module de données renvoyant à `20` §11.4 : la valeur finale n'engage aucun code. Un seuil sous 20° exige l'arbitrage écrit du fondateur, `CLAUDE.md` §4 amendé, et l'interdiction d'un succès en fond plein | G3d, TD1.7 (seuil en paramètre) | DS-2 — **tranché par `expert-ux` : `#3ccfcf` sous KEO** (25° de l'action), vitrine `#2dd4bf` ; seuil **20°** face à l'action (repos, survol, appui) et à l'information, dans chaque charte (`20` §11.3, §11.4) |
| 2 | **F2, un seul vert** (`20` §11.9) : s'il est accepté, la vitrine change de vert | G3e, TD4.2 (liste explicite des noms modifiés) | DS-1 (l'instantané) ; **accepté le 2026-10-29**, mise à jour par DS-14 |
| 3 | **Pages légales** : vitrine (`02` §21.2) ou KEO (`20` §11.1) | TD4.4, TD3.3, G8 | DS-4 — **tranché : vitrine** (`02` §21.2 ; F1 confirmé par le fondateur le 2026-10-29) |
| 4 | **Transformations d'état** : aucune (`20` §11.5) ou sous `motion-safe:` (`02` §21.5 point 7) | G8, TD5.7 | DS-4 — tranché le 2026-10-28 : aucune ; **amendé par le fondateur le 2026-10-29 (F6) : sous `motion-safe:` seulement**, jamais `transition-all` ; G8 assouplie à DS-5 |
| 5 | **Backoffice sous 1024 px** *(écrit le 2026-10-28 dans `17b` §1.7 et §7.2 M4, `02` §21.5 point 8)* : navigation compacte de 768 à 1023 px, écran « poste de travail » sous 768 px. Les deux documents le disent désormais | TD6.2, §12.2 | DS-10 — **tranché : ce compromis** (`02` §21.5 point 8 amendé), **plus une condition de hauteur** (écran « poste de travail » sous 500 px de haut ; F7 tranché par le fondateur le 2026-10-29) |
| 6 | **« Candidatures » a 12 caractères** pour une limite de 11 (`17` §2.2) | TD2.2 | DS-6 — **tranché : limite de 11 maintenue** ; l'entrée est omise jusqu'au Lot 3 et son libellé n'entre qu'avec elle (`expert-marketing`) |
| 7 | **La navigation principale reste-t-elle sur l'écran bloquant des CGU ?** `account.spec.ts` n'attend que l'absence de la navigation du compte | TD5, `account.spec.ts` | DS-6 — **tranché : non**, l'écran bloquant est une page autonome sans navigation principale (`20` §11.8, `02` §21.5 point 9) |
| 8 | **Entrées des Lots 2 à 5** : masquées (`17` §2.2) ou « bientôt » (`02` §21.5 point 9) | TD2.3 | DS-6 — **tranché : omises** jusqu'à leur lot (`02` §21.5 point 9) |

### 12.6 Les familles TK1 à TK8 du jalon RK (D75) *(ajouté le 2026-10-30)*

**Source :** `archives/jalons/rk-fiche.md` § Tests, repris sans reformuler les mesures. E2e web dans un nouveau
`apps/web/e2e/charter-rendering.spec.ts` (session semée, construction de production) ; cas du
backoffice dans `backoffice.spec.ts`. Lecture après la fin des animations
(`Promise.all(el.getAnimations().map((a) => a.finished))`) ; état appuyé par `mouse.down()`, lecture,
sortie de l'élément, `mouse.up()` (aucun clic). Ordre : filet d'abord (RK-1, cas en `test.fail()`
annotés « RK-n ») ; chaque commit de correction retire le `test.fail()` de ses cas et relève les
planchers.

| Famille | Cas | Mesure |
|---|---|---|
| TK1 Boutons | TK1.1 (RK-1) | `box-shadow` ≠ `none` au repos et porte la valeur calculée du vert ; différent et plus large au survol ; `none` sur `aria-disabled` et `disabled`, au repos et au survol |
| | TK1.2 (RK-2) | Ratio `getBoundingClientRect().width / offsetWidth` : 0,98 ± 0,01 à l'appui, 1,03 ± 0,01 au survol sous `no-preference` ; 1 sous `reducedMotion: reduce` et sur un bouton désactivé |
| | TK1.3 (RK-3) | `font-weight` 700 (principal) et 600 (secondaire, texte), membres et BO |
| | TK1.4 (RK-4) | Petits boutons du BO : `box-shadow: none`, ratio 1 dans les trois états (liste en données, entrée introuvable = échec) ; bouton standard du BO soumis à TK1.1 et TK1.2 |
| | TK1.5 | `border-radius` calculé d'une carte = 16 px sous KEO |
| TK2 Halo (RK-9) | TK2.1 | Le fond du conteneur porte le dégradé ; aucun ancêtre ne le tronque |
| | TK2.2 | Sonde de pixels (capture décodée par `createImageBitmap` et un canvas, sans nouvelle dépendance ; sinon `architecte` tranche) : écart de luminance ≤ 2/255 entre lignes à ± 4 px du bas de l'en-tête ; pixel sous le centre plus clair que la page d'un seuil posé par `expert-ux` : **de 16/255 à 25/255** (RK-0, ci-dessous) ; négatif : le rectangle du parent dépasse le seuil |
| | TK2.3 | `scrollWidth ≤ innerWidth` à 320, 375 et 768 px (membres), 375 et 768 (BO), halo présent |
| TK3 Typographie | TK3.1 (RK-5) | Greffé sur les passes axe de §12.2 : chaque `h1`–`h4` visible a pour première famille celle de `--font-display`, une taille de l'ensemble des `--text-*` KEO, identique à 375 et 1 440 px ; au moins un titre par écran |
| | TK3.2 | Surtitre : Manrope, 700, capitales, ≥ 12 px |
| | TK3.3 (RK-6) | `letter-spacing` d'un `h1`/`h2` = token, négatif ; chiffre clé 800 ; `h3`/`h4` 700 |
| | TK3.4 (RK-7) | `-webkit-font-smoothing: antialiased` sur le conteneur KEO, le `html` du BO et le dialogue des CGU ; `auto` sur le `body` de `/fr` et `/en` (assertion à part dans `vitrine-unchanged`) |
| TK4 Cartes, badges | TK4.1 (RK-10) | Luminance du contour d'une carte cliquable plus haute au survol, valeur = token ; carte non cliquable immobile |
| | TK4.2 (RK-11) | Fond du badge opaque et égal à un token ; Manrope ≥ 700 ; contraste ≥ 4,5 ; paires dans la matrice G3d ; texte présent (P7) |
| TK5 Focus (RK-13) | TK5.1 | Après navigation par clic, par `Entrée` et après le lien d'évitement : `activeElement` est le `h1` ou `main`, `outline-style: none` ; même cas au BO |
| | TK5.2 | Au `Tab`, lien, bouton, champ et région défilante gardent un anneau ≥ 2 px non masqué (TD5.4, jamais relâché) |
| TK6 Tableau (RK-15) | TK6.1 | Fond de `thead th` plus clair que les lignes ; Manrope 700 |
| | TK6.2 | Au survol et au focus clavier du lien d'une ligne : une ombre de 2 px de la couleur de `--color-brand-primary` sur la première cellule ; aucune au repos ni sur la ligne voisine |
| TK7 Gardes statiques | TK7.1 = **G3i** | (a) sur les sources : échec si le bloc KEO redéfinit un nom des espaces `--shadow-`, `--inset-shadow-`, `--drop-shadow-`, `--text-shadow-`, `--breakpoint-`, `--container-`, si `tokens.css` contient `@theme inline`, ou si un `color-mix` sort de la liste de RK-A ; (b) sur la construction (spec par front, feuilles servies) : tout utilitaire d'un token redéfini sous KEO lit `var(--nom)`, jamais la valeur vitrine. Auto-test : `.shadow-action-glow{--tw-shadow:none}` échoue, CSS minifié et CRLF compris ; token redéfini sans consommateur = échec sauf entrée justifiée |
| | TK7.2 | Toute classe littérale des fichiers de classes a une règle compilée (liste blanche justifiée) ; négatif : `tracking-wide` |
| | TK7.3 | Aucun `clamp(` ni `vw` dans les `--text-*` et `--tracking-*` effectifs sous KEO ; G8 refuse `text-display`, `text-heading-*`, `text-lead`, `text-figure-*` sous KEO |
| | TK7.4 | G8 : `motion-safe:…active:scale-(--scale-press)` accepté ; `active:scale-…` et `hover:scale-…` hors `motion-safe:` refusés |
| | TK7.5 | `badge-error-bg` consommé par le seul badge d'erreur ; aucune propriété de lissage déclarée dans `:root`, `html` ou `body` |
| TK8 Vitrine | TK8.1 | Fixture TD4 inchangée, G3e verte |
| | TK8.2 | Nouvelle fixture `vitrine-states.json`, prise **sur le parent de RK-1** : survol, appui et focus des boutons d'appel et d'une carte de la landing (`box-shadow`, ratio, `border-color`, `font-weight`, `-webkit-font-smoothing`, `transition-*`) ; prouve qu'aucun effet RK ne fuit par un composant partagé |

**Seuils de TK2.2, posés par `expert-ux` au RK-0** (calcul : `20` §11.5). Luminance = luma
`0,2126 R + 0,7152 G + 0,0722 B` sur les canaux 8 bits de la capture, en /255. Le pixel « sous le
centre » est au centre horizontal du conteneur d'écran, à 4 px sous son bord haut (marge intérieure,
aucun contenu) ; la page est `surface-page` (`#0a0b0a`, luma 10,7). Attendu à 15 % et
`--size-header-glow` 16 rem : `#0d291d`, écart **23,4/255** ; borne basse **16/255** (≈ 10 % : halo
absent ou trop faible = échec), borne haute **25/255** (au-delà de 15 % plus l'arrondi : 18 % donne
28,5 = échec). Écart entre lignes à ± 4 px du bas de l'en-tête : attendu 0,74/255 pour un seuil de
2/255. Le tramage des dégradés de Chromium se neutralise en moyennant chaque ligne sur 16 px de large.

### 12.7 Traçabilité de `20` §11 : chaque phrase normative a sa preuve (R3) *(ajouté le 2026-10-30, relu phrase à phrase le 2026-11-01, L2A-01)*

Chaque règle de `20` §11.1 à §11.8 renvoie à un cas (TK, TD, TN, T, TM), à une garde (G, ESLint,
annexe) ou à la recette humaine (§12.4, recette de fin du jalon RK). §11.9 (points soumis au fondateur)
ne porte aucune règle. Une ligne sans preuve est un défaut du plan, pas de la charte.

Relecture du 2026-11-01 : toute phrase de §11.1 à §11.8 portant « jamais », « toujours », « seul »,
« au plus » ou un impératif a sa ligne (une ligne peut en couvrir plusieurs, qu'elle nomme). Chaque
identifiant cité (TK, TD, TN, TM, T, G, DS) a été retrouvé dans `apps/*/e2e`, `apps/*/tests`,
`packages/test-kit` ou dans les familles de ce plan (T1, T16 et TM11 : cas du plan, écrits au lot de
leur objet ; RK-17 : décision de `decisions-detail.md`, non un cas). Là où un cas ne mesure qu'une partie
de la phrase, la ligne le dit et renvoie le reste à la recette humaine, avec son motif.

| § | Règle | Preuve |
|---|---|---|
| 11 | Aucune valeur de couleur ajustée, sauf `badge-error-bg` (RK-B) ; `keo-emerald.css` jamais importé | G3, G3c, G3e |
| 11.1 | Frontière par le groupe `(member)` ; pages légales publiques en vitrine ; CGU du parcours en KEO ; inscription, connexion et écrans hors session en KEO ; 404 et erreurs de niveau `[locale]` et bandeau cookies en vitrine | TD4.4, TD3.1, G8, TD3.6 |
| 11.1 | Vitrine : valeurs de `tokens.css` et direction D59 gardées ; revue visuelle de la page avant sa mise en ligne | G3e, TD4.1, TD4.2 ; revue visuelle D59 : recette humaine (porte de production, `21` §5.8) |
| 11.1 | Un seul `tokens.css`, dans `packages/ui`, importé par les deux fronts ; attribut posé à deux endroits | G3, G8, TD3.1, TD3.2 |
| 11.1 | Le bloc KEO redéfinit tout `--color-*` hors `KEO_INHERITS`, familles, rayons, graisses d'action, contour secondaire | G3c, TD3.1, TD3.2 |
| 11.1 | Échelles d'espacement et de texte, durées, points de rupture inchangés sous KEO | G3i (a) (points de rupture, conteneurs), TK7.3 (texte), TD5.7 (durées, sous mouvement réduit seulement) ; espacement, et valeur des durées (120 ms, `ease-standard`) sous KEO, qu'aucune garde ne lit : recette humaine (revue de code) |
| 11.1 | Un seul vert `#1dd68a` sur toute la plateforme (F2) | G3e, TD3.3, TD4.2 |
| 11.2 | Succès en sarcelle, à au moins 20° de l'action et de l'information | G3d, TD1.7 |
| 11.2 | Rouge « danger » opaque, inchangé, aucun rouge translucide | G3b, `account-data.spec` |
| 11.2 | Fonds teintés opaques ; violet réservé au backoffice | G3c, G3f |
| 11.2 | La couleur ne porte jamais seule une information | TD5.8, TD6.5, G3g, TK4.2 |
| 11.2 | Contraste AA sur chaque surface réelle ; tokens seuls | G3d, TD7, G3 |
| 11.2 | Aucun taux, aucun net ; provenance des montants au BO | T16 ; provenance : recette humaine (Lot 5) |
| 11.2 | Densité par registre, lignes de 36 px au backoffice | TD7 (`wcag22aa`) ; densité : recette humaine (§12.4) |
| 11.3 | Valeurs de chaque token par charte | G3c, TD3.1, TD3.2, G3e |
| 11.3 | Alias redéclarés quand leur cible l'est (fermeture), nouveaux rôles déclarés dans `@theme` d'abord | G3c (TD1.3, TD1.6) |
| 11.3 | Couleurs de rôle : liste fermée, toujours suivies du rôle écrit | G3g, TD5.8 |
| 11.3, 11.7 | Le vert reste rare : `text-brand` jamais en texte courant ni sur un montant, jamais seul porteur d'un état ; montant jamais en vert (K7) | G3d (contraste de `text-brand` seulement) ; usage : recette humaine (§12.4, fondateur, K1 à K23) : aucune garde ne lit l'emploi d'un jeton |
| 11.3, 11.8 | Bouton désactivé (`action-disabled-bg`) toujours expliqué à côté | TK1.1, TK1.2 (ni ombre ni transformation) ; explication adjacente : recette humaine (§12.4, fondateur) : dépend du texte de chaque écran |
| 11.3 | Badge vérifié bleu, jamais une coche seule ni collé à un nom, texte « Vérifié · ⟨réseau⟩ · ⟨mois année⟩ » | TK4.2 (texte présent) ; forme et place : recette humaine (Lot 2) |
| 11.3 | `badge-error-bg` confiné au badge d'erreur, jamais une notice ; `verified-bg`, `border-hover` | TK7.5, TK4.2, TK4.1 |
| 11.3 | Couleurs de données réservées aux graphiques étiquetés | Recette humaine (aucun graphique avant le Lot 5) |
| 11.3 | Ligne survolée du tableau dense : `surface-raised` + filet `effect-bo-row-indicator` | TK6.2 |
| 11.4 | Matrice des contrastes, paires propres, pic du halo composé | G3d |
| 11.4 | (1) ni texte tertiaire ni texte d'erreur sur `surface-active` | G3h, G3d |
| 11.4 | (2) toute carte porte `border-default`, les dialogues `shadow-lg` | Recette humaine |
| 11.4 | (3) texte d'erreur lisible sur une ligne survolée, pas au-delà | G3d |
| 11.4 | (4) halo sur la page seulement, jamais sur `surface-card` ou plus clair | TK2.1 |
| 11.4 | (5) ni texte tertiaire ni texte d'erreur à moins de `spacing-5` d'un bouton principal survolé | Recette humaine |
| 11.4 | (6) surtitre ou badge jamais vert | TK4.2 (fond = token de la matrice) ; surtitre : TK3.2 |
| 11.4 | (7) halo d'en-tête à 15 % au plus | G3i (a), TK2.2 (borne haute) |
| 11.5 | Familles : Manrope pour tous les titres `h1`–`h4`, chiffres, boutons, surtitres, badges ; Source Sans 3 pour le corps | TK3.1, TD3.1, TK4.2, TK6.1 |
| 11.5 | Aucun token fluide sous KEO, `LegalMarkdown` compris ; tailles inchangées | TK7.3, TK3.1 |
| 11.5 | Graisses et approche : `h1` 800 et `h2` 700 serrés, `h3`/`h4` 700, chiffre clé 800 | TK3.3 ; `h3`/`h4` sans approche serrée : recette humaine (TK3.3 ne mesure que leur graisse) |
| 11.5 | Surtitre : `text-xs`, Manrope 700, capitales, `tracking-overline` | TK3.2, TK7.2 |
| 11.5 | Plancher de 12 px ; tailles inchangées (16 px membres, 14 px backoffice) | TK3.2, TK3.1 (taille dans l'ensemble des `--text-*`, identique à 375 et 1 440 px) ; plancher ailleurs, 16 px et 14 px : recette humaine |
| 11.5 | Rayons `radius-md`, `radius-sm`, `radius-pill` (boutons, badges, pastilles) | TK1.5 (carte seule) ; les autres : recette humaine (§12.4, fondateur, K1 à K23) |
| 11.5 | Boutons : 700 (principal, danger), 600 (secondaire, texte) | TK1.3 |
| 11.5 | Item de navigation : actif en 600 | TD5.8 |
| 11.5 | Polices par `next/font/local`, aucun appel à Google Fonts, `latin` seul câblé, budget ; chargées par les deux seules mises en page KEO, jamais par la vitrine | G4f, TD1.10 (G8), ESLint, TD3.4, TD8.1 ; écritures non couvertes en repli système : recette humaine (§12.4, glyphes hors police) |
| 11.5 | Chiffres tabulaires de Manrope | TD3.5 ; emploi sur les montants : recette humaine (Lot 5, premier montant affiché) |
| 11.5 | Lissage sous KEO seulement, rien dans `:root`, `html`, `body` | TK3.4, TK7.5 ; rendu : recette sur Mac |
| 11.5 | Rayon des cartes 16 px ; contour secondaire 1 px sous KEO, 2 px en vitrine | TK1.5, TD4.2 ; contour sous KEO : recette humaine |
| 11.5 | Anneau intérieur de la barre du bas | TD5.4 |
| 11.5 | Cartes plates au repos ; `shadow-lg` réservé aux couches | Recette humaine |
| 11.5 | Ombre lumineuse : valeurs, plus forte au survol, absente si désactivé, jamais `none` en neutre | TK1.1, G3i (a) (b) |
| 11.5 | Petits boutons BO sans effet ; boutons de connexion BO avec | TK1.4 |
| 11.5 | Halo : fond du conteneur, sans bord, pic `#0d291d`, nul avant la barre du bas, `--size-header-glow` 16 rem | TK2.1, TK2.2, TK2.3 |
| 11.5 | Borne de `color-mix`, jamais de `/NN` sur une couleur | G3i (a), G3c |
| 11.5 | Transitions nommées, jamais `transition: all` | G8 (TD1.10) |
| 11.5 | Agrandissement 1,03 et réduction 0,98 sous `motion-safe:`, jamais désactivé | TK1.2, TK7.4 |
| 11.5 | Bouton texte sans agrandissement ; ombre lumineuse jamais substituée à l'anneau `focus-ring` | TK1.2 (bouton principal et bouton indisponible), TK5.2 (anneau au `Tab`) ; bouton texte et secondaire survolés : recette humaine (aucun cas ne les mesure) |
| 11.5 | Soulèvement des cartes sous `motion-safe:` ; transformation sans décalage de mise en page | G8, TD5.7, TK2.3 (et mesure de RK-4 à 320 px) |
| 11.5 | Mouvement réduit : aucune transformation, durées nulles, squelette sans balayage | TD5.7, TK1.2 |
| 11.6 | K1, K2, K3 (succès sarcelle, rouge opaque, aucun `rgba`) | G3d, G3b, G3c |
| 11.6 | K4, K5, K7, K15, K16, K17, K21, K22 (composants des Lots 3 à 5, vitrine, libellés) | Recette humaine, au lot de chaque composant (RK-17) |
| 11.6 | K6 (icône `lock` par `icons.ts`) | ESLint ; recette humaine (Lot 4) |
| 11.6 | K8, K9 (halo, ombre, mouvements aux intensités de la référence) | TK1.1, TK1.2, TK2, G8 |
| 11.6 | K10 (plancher, surtitre `text-secondary`) | TK3.2 |
| 11.6 | K11 (tranches et alias avant révélation) | T1, TM11 |
| 11.6 | K12 (badge par réseau, daté) | TK4.2 ; recette humaine (Lot 2) |
| 11.6 | K13 (rôle jamais porté par la couleur d'un nom) | G3g |
| 11.6 | K14 (filet de 2 px, 4 px réservé à la vue identifiée) | TK6.2 |
| 11.6 | K18 (anneau `focus-ring`, contour des champs) | TD5.4, TK5.2 |
| 11.6 | K19 (polices et CSS servis par l'origine) | G4f, TD3.4, TD8.1 |
| 11.6 | K20, K23 (tokens par rôle, valeurs non reprises) | G3, G3c |
| 11.7 | Test du logo ; parades (pas de bouton vert rond à icône seule, une seule action principale par écran en libellé verbe + objet, halo jamais sur une carte, surtitre jamais vert, commercial nommé et statuts datés au premier écran) | Recette humaine (§12.4, fin du jalon RK) ; halo : TK2.1 ; surtitre : TK3.2 |
| 11.8 | Gabarits par largeur (membres sous et dès 1 024 px ; backoffice dès 1 024 px, de 768 à 1 023 px en navigation compacte, sous 768 px de large ou 500 px de haut en écran « poste de travail »), un seul `<nav>` restylé par le CSS | TD5.1, TD5.2, TD6.1, TD6.2 ; absence de détection de largeur en JavaScript : recette humaine (revue de code, TD5.1 ne voit que le DOM) |
| 11.8 | Page autonome KEO (inscription, connexion, déconnecté, compte supprimé, CGU à ré-accepter) : INFLUX et langue en tête, une colonne, aucune navigation ; pages légales publiques en gabarit de vitrine | TD5.6 (c), TD6.4, `account.spec` (écran des CGU sans navigation, §12.5 point 7), TD4.4 ; en-tête et colonne `container-narrow` : recette humaine (§12.4, fondateur) |
| 11.8 | Entrées sans écran masquées, jamais retirées une fois apparues | TD2.3 |
| 11.8 | Aucun repli de colonne, rien de persisté | Garde annexe 2 (stockage) |
| 11.8 | Lien d'évitement en premier ; focus au `h1` après navigation | TD5.3, TD5.5, TD6.1 |
| 11.8 | Anneau sur tout élément interactif ; aucun anneau sur un `h1`–`h4` ou `main` focalisé par programme | TK5.2, TD5.4 ; TK5.1 |
| 11.8 | Règle du focus : sélecteur fermé `:where(h1, h2, h3, h4, main)[tabindex="-1"]`, jamais un `[tabindex="-1"]` générique ; le tabindex itinérant des onglets de canaux garde son anneau | TK5.1, TK5.2 (effets sur les pages existantes) ; forme du sélecteur : recette humaine (revue de code, aucune garde ne le lit) ; onglets : recette humaine (Lot 4) |
| 11.8 | Bouton principal, secondaire, texte (états R, S, A, D) | TK1.1 à TK1.4, G3d |
| 11.8 | Boutons : chargement (`aria-busy`, largeur figée), erreur portée par le formulaire | Recette humaine |
| 11.8 | Bouton danger D72 | G3b, `account-data.spec` ; au backoffice, jamais par raccourci (`20` §5 niveau 3) : recette humaine (Lot 5, premières actions destructives) |
| 11.8 | Carte : rayon, carte cliquable seule réactive, contour éclairci | TK1.5, TK4.1 |
| 11.8 | Carte : anneau autour de la carte à lien étiré, squelette de même hauteur, notice dans la carte, bloc intérieur `surface-raised` | TD5.4 (anneau, pages existantes) ; le reste : recette humaine (au lot de chaque carte, Lot 2 pour la première) |
| 11.8 | Badges de rôle, vérifié, de statut | G3g, TD5.8, TK4.2, TK7.5, TD6.5 |
| 11.8 | Onglets segmentés (canaux, Lot 4) | Recette humaine (Lot 4) |
| 11.8 | Sous-entrée de navigation, page-menu (D74) | TN1 à TN9 |
| 11.8 | Champ : contour `border-strong`, erreur 2 px reliée par `aria-describedby` | G3d, TD7 (état d'erreur) |
| 11.8 | Champ : libellé au-dessus en 600, aide en `text-secondary`, exemple en `text-tertiary` jamais seul libellé, état désactivé | Recette humaine (§12.4, fondateur) : aucun cas ne mesure le libellé ni l'état désactivé |
| 11.8 | Notice : fonds de famille, erreur sans fond teinté | G3b, TK7.5, TD7 |
| 11.8 | Notice : `role="status"` ou `role="alert"`, icône du couple de la famille, non refermable pour un état permanent | `error-notice.test.ts` (web et backoffice : erreur en `role="alert"` avec icône) ; succès, alerte et information, non refermable : recette humaine (au lot du premier écran qui en porte) |
| 11.8 | Tableau dense : en-tête `surface-hover` Manrope 700, filet de ligne, région défilante | TK6.1, TK6.2, TD6.2, TD6.5 |
| 11.8 | Tableau dense : en-tête collant, lignes de hauteur fixe en squelette, deux états vides de `17b` §2.3, chiffres tabulaires | Recette humaine (§12.4, backoffice : densité) |
| 11.8 | État vide (pas de « 0 » ni d'illustration) | Recette humaine (DS-8 : accueil neuf sans « 0 ») |
| 11.8 | Squelette sans balayage sous mouvement réduit | TD5.7 ; `aria-busy` sur le conteneur et « Chargement… » masqué : recette humaine (§12.4, lecteur d'écran) |
| 11.8 | Item de navigation, pastille de compteur | TD5.1, TD5.4, TD5.8 ; pastille « 9+ » : recette humaine (§12.4) ; cible tactile, barre du bas en icône sur libellé : recette humaine (§12.4, iPhone) ; retard écrit « ⚑ ⟨n⟩ hors délai » au backoffice : recette humaine (Lot 5) |
| 11.8 | En-tête de page : `h1` Manrope 800 serré, halo du conteneur, un seul par page | TK3.1, TK3.3, TK2.1 |
| 11.8 | En-tête de page : fil d'Ariane `text-sm` à partir du niveau 2, action principale à droite (desktop) ou sous le titre en pleine largeur (mobile) | Recette humaine (Lot 2, première page de niveau 2) |
| 11.8 | Surtitre | TK3.2 |
| 11.8 | Dialogue : voile, focus piégé, `Échap` | TD3.6, DS-7 (e2e du dialogue des CGU) |

---

**Ce document ne modifie aucun autre fichier.** Il n'introduit aucun code applicatif, aucune migration
et aucun fichier dans `apps/`, `packages/` ou `supabase/` : les extraits de code qu'il contient sont
des **illustrations de référence** destinées à `dev-react-node`, `expert-database` et `integrateur`.
