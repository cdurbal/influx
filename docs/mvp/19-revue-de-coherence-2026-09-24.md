# Revue de cohérence de la documentation du MVP

> **Date :** 2026-09-24 · **Demandée par :** le fondateur · **Réalisée par :** Claude Code, en lecture
> de `CLAUDE.md`, `implementation_plan.md`, des 21 documents de `docs/mvp/` et d'un contrôle ponctuel
> du code.
> **Objet :** repérer les contradictions entre documents, les décisions périmées et les oublis ;
> signaler les fonctionnalités nouvelles ; faire trancher les contradictions par le fondateur.
> **Statut :** corrections factuelles appliquées (§1) ; **contradictions (§2) et oublis (§3)
> tranchés par le fondateur le 2026-09-24 et reportés** dans la documentation.
> **Règle :** `CLAUDE.md` reste la source de vérité. Ce document explique **pourquoi** les décisions
> D44 à D57 existent ; la décision elle-même vit dans `CLAUDE.md` §13.

---

## 0. Préalable : le statut du code (D44)

Le fondateur a précisé le 2026-09-24 que **tout le code, sauf la landing page, est une maquette de
démonstration jetable**, destinée à faire valider la vision du MVP par des partenaires. Elle n'ira
jamais en production et ne sera pas reprise. Conséquences écrites dans `CLAUDE.md` §16 :

- **les spécifications font foi**, jamais la maquette ;
- **le produit réel repart du Lot 0** de `00-cadrage-mvp-v2.md` ;
- l'avancement de la maquette (**37 missions sur 40**) **ne mesure pas** l'avancement du MVP, qui
  n'a pas commencé ;
- la landing page doit être **détachée de la maquette** et **alignée sur le MVP courté** avant sa
  mise en ligne (D48).

Ce préalable change la lecture de la revue : les écarts entre la maquette et les spécifications ne
sont plus des défauts à corriger pour la production. Ils sont listés dans `implementation_plan.md`,
section « Écarts connus », pour ne pas être présentés à tort comme la vision du MVP.

---

## 1. Corrections factuelles appliquées le 2026-09-24

Aucune ne modifie une décision : elles alignent des textes sur des décisions déjà prises.

| Fichier | Correction |
|---|---|
| `CLAUDE.md` | En-tête de statut réécrit ; §16 créé (maquette jetable) ; §8 Apollo aligné sur A7 / D33 ; §13 : D44 à D57 ajoutées ; §14 : dépôt GitHub existant, D2 / D5 / D12 / D18 / D37 / D39 / D40 cochées ; §14.5 : Lot 0 « départ de zéro » ; glossaire : « Maquette » |
| `implementation_plan.md` | Statut jetable ; décompte corrigé (37 / 40, et non « 32 ») ; Lot 4 marqué terminé ; mission 6.3 (guide de transition vers Supabase) **annulée** car contraire à D44 ; section « Écarts connus entre la maquette et les spécifications » |
| `00-cadrage-mvp-v2.md` | Note de mise à jour ; D12, D2 / D5 / D18, D37, D39, D40 marquées tranchées ; délai Apollo 24 h (et non 1 h) ; trois sous-domaines d'envoi ; Lot 0 « départ de zéro » ; skills marquées créées |
| `audit-implementation-2026-09-19.md` | Portée révisée par D44 ; état des écarts au 2026-09-24 |
| `13` | Alerte A6 remplacée par l'alerte « montant non saisi » de `14` RG8bis (l'affaire existe toujours depuis le 2026-09-19) |
| `15`, `04` | File `email_send_failures` renumérotée **16** (collision avec la file 14) ; catalogue de 16 files |
| `17b` | I1, I3 et I6 marquées résolues |
| Skill `profile-verification` | Le badge est attribué par un agent INFLUX (`agent` ou `admin`), conformément à `03` §3.2 et `08` RG9 — et non « par un administrateur » seul |

---

## 2. Contradictions tranchées par le fondateur

Chaque contradiction oppose deux documents qui ne peuvent pas être vrais en même temps. La
« Recommandation » est celle de la revue ; l'**arbitrage** du fondateur (2026-09-24) suit chaque
cas et est reporté dans `CLAUDE.md` §13. **Sept des huit arbitrages suivent la recommandation ;
D48 s'en écarte** (aligner la landing page, mais sans afficher de taux).

### D45 — Le moment de la révélation d'identité

| Position A | Position B |
|---|---|
| `CLAUDE.md` D16 et §4.3, `00` §4.2 point 3 : « la révélation d'identité est un effet de la **validation** » par le commercial | `01` §4.3, `13` RG5, RG42, RG74 : **valider n'est pas révéler**. La révélation n'a lieu qu'à la **seconde acceptation** des parties, sur un écran d'acceptation ; sans réponse sous 7 jours, clôture sans suite |

**Recommandation :** position B. C'est la plus récente et la plus détaillée ; elle protège le
créateur (personne n'est révélé sans l'avoir accepté) et rend la clause de non-contournement
opposable dossier par dossier (`13` RG72).

> ✅ **Arbitrage du fondateur (2026-09-24) : double acceptation (position B).** Reporté dans
> `CLAUDE.md` (D16, D45, §4), `00` §4.1 et §4.2, skill `intermediation-tracking`.

### D46 — Les coordonnées de contact après l'ouverture

| Position A | Position B |
|---|---|
| `CLAUDE.md` D40, `06` RG38, `13` RG76, `04` §6.2 : à la révélation, le créateur voit **l'e-mail, le téléphone, le prénom et la page de contact** de l'interlocuteur de la marque ; la marque voit les **réseaux** du créateur | `12` RG29 et RG103 point 5 : « les coordonnées directes **des deux côtés restent masquées** dans le produit après l'ouverture » ; `15` : « visibles des seuls rôles internes » |

La position A est en outre **asymétrique** : le créateur obtient de quoi joindre la marque en direct,
la marque n'obtient que des pseudos de réseaux.

**Recommandation :** position B aménagée — révéler l'**identité** (nom de la marque, prénom et
fonction de l'interlocuteur ; pseudos et réseaux du créateur), **jamais l'e-mail ni le téléphone**.
Le contrat est envoyé par le commercial : les parties n'ont pas besoin de se joindre hors
d'INFLUX, et `CLAUDE.md` §3 fait d'un parcours qui pousse à s'échanger des coordonnées un critère
de rejet.

> ✅ **Arbitrage du fondateur (2026-09-24) : l'identité, jamais les coordonnées.** Reporté dans
> `CLAUDE.md` (D40, D46), `06` (RG35, RG38, RG42, CA10, libellés), `11`, `13` (RG69, RG76,
> libellé `contact_details_in_text`), `12` RG29, `03` C(9), `04` (§12.11), `18` T1.6.

### D47 — Les apartés privés commercial ↔ une seule partie

Fonctionnalité **codée dans la maquette** (commits `a432a45` et `b7dd0ad`) : dans une
conversation à trois, le commercial peut échanger en privé avec la marque seule, ou avec le
créateur seul. **Aucune spécification ne la décrit**, et elle entre en tension avec `12` :

- RG2 et RG38 : un fil unique, vu dans le même ordre par les trois participants ;
- RG53 : les accusés de lecture entre parties ;
- RG101 à RG103 : l'information sur la supervision doit dire qu'un commercial peut parler en privé
  avec l'autre partie ;
- les notifications (§H), la détection de coordonnées (§D) et le droit d'accès RGPD (`15` Q7).

Elle répond pourtant à un vrai besoin, relevé par `17b` I11 / V5 : aujourd'hui, un commercial ne
peut pas écrire à un seul membre sans sortir de la plateforme. C'est aussi le geste naturel d'un
courtier, qui parle séparément à chaque partie.

**Recommandation :** conserver, en l'annonçant aux deux parties, puis écrire un additif au
document `12` (droits d'accès en base, détection, notifications, conservation) avec l'avis
d'`expert-conformite-rgpd` (veto).

> ✅ **Arbitrage du fondateur (2026-09-24) : conservés, et annoncés aux deux parties.** Cadre posé
> en additif de `12` ; spécification détaillée à écrire par `product-owner` sous veto
> d'`expert-conformite-rgpd`. **Confidentialité vis-à-vis de l'autre partie tranchée le même jour
> (`12` Q12) : confidentiel par défaut**, le commercial ne rapporte jamais ce qu'une partie lui a
> confié sans son accord (`12` RG122).

### D48 — Le discours public pendant le MVP

La **landing page**, seule partie du code conservée, décrit le modèle **antérieur** au cadrage du
2026-09-18 : « contrat et paiement sécurisés dans INFLUX », « le contrat se signe dans INFLUX »,
paiement par un prestataire agréé, « pseudos masqués jusqu'à la signature du contrat ». Or au MVP,
le contrat et le paiement sont **hors plateforme** (A1) et la révélation a lieu à l'ouverture de la
mise en relation. Publier la page en l'état promettrait des fonctions qui n'existent pas.

S'y ajoute une tension sur le taux : `07` RG68 et la landing annoncent **35 % (20 % + 15 %) et un net
créateur de 65 %**, alors que pendant le pilote la commission est **négociée au cas par cas** (`14`
admet des dérogations) et que `04` §12.6 attend encore l'accord du fondateur sur des bornes nettes
dérivées du 35 %.

**Recommandation :** aligner la landing page sur le MVP courté avant sa mise en ligne, en
conservant l'affichage du barème de 35 % comme **barème standard** (c'est l'invariant de
`CLAUDE.md` §3, et le montrer tôt évite le rejet tardif du net de 65 %).

> ✅ **Arbitrage du fondateur (2026-09-24) : aligner la landing page sur le MVP courté, sans
> aucun taux.** Précision demandée dans la foulée : **aucun net créateur estimé non plus** dans les
> espaces membres pendant le pilote. Reporté dans `CLAUDE.md` (§3, §4.2, §5.2, D48), en tête de
> `07`, `09`, `11`, `13`, `17`, dans `07` §G, et dans `docs/landing-page/00` et `04`. **Risque
> signalé** : sans net affiché, un créateur peut saisir ce qu'il veut percevoir au lieu du coût
> total (`07` §G) ; la relecture du tarif à la validation du profil devient le garde-fou.

### D49 — Le dépassement du délai de la file de validation

| Position A | Position B |
|---|---|
| `13` RG26 et RG99 : l'entrée **reste en file** jusqu'à décision ; l'initiateur est informé, une escalade part à J+1, la décision tardive est marquée | Skill `intermediation-tracking` et `01` étape 3 : passage **automatique en `expired`** au dépassement du délai |

**Recommandation :** position A. Une demande effacée par le seul écoulement du temps est une
promesse rompue, et le modèle de données n'a aucun motif d'expiration pour cette cause.

> ✅ **Arbitrage du fondateur (2026-09-24) : l'entrée reste en file (position A).** Skill
> `intermediation-tracking` alignée ; `13` Q1 close.

### D50 — Qui écrit sur une affaire

| Position A | Position B |
|---|---|
| `14` RG39 : le **commercial responsable** et l'**administrateur** seulement ; un autre agent lit et demande la réattribution | `03` §3.5 : **tout agent** peut écrire |

**Recommandation :** position A. Les montants et la commission sont l'intéressement du commercial
responsable ; la réattribution journalisée sert d'échappatoire en cas d'absence.

> ✅ **Arbitrage du fondateur (2026-09-24) : responsable et administrateur seulement.** `14` Q7
> close ; `03` §3.5 annoté, à formaliser par `expert-cybersecurite`.

### D51 — Qui retire un badge

| Position A | Position B |
|---|---|
| `03` §3.2 et `08` RG75 : un agent, **avec l'approbation d'un administrateur distinct** (double validation) | `06` : un **administrateur** seul |

**Recommandation :** position A, déjà appliquée par la matrice des droits et par `08`.

> ✅ **Arbitrage du fondateur (2026-09-24) : agent + approbation d'un administrateur distinct.**
> `08` Q7 close. `06` le disait déjà dans ses acteurs et ses cas limites : l'écart signalé par `08`
> était périmé.

### D42 — Le renouvellement d'une collaboration (décision ouverte depuis le 2026-09-18)

`14` RG4 exige une **nouvelle mise en relation** pour une seconde collaboration entre les mêmes
parties, mais `13` RG104 interdit toute seconde mise en relation sur le même triplet marque +
créateur + campagne, et une mise en relation révélée ne sort jamais de cet état. Le cas « ils
refont la même campagne six mois plus tard » n'a donc aucun chemin.

**Recommandation (celle de `CLAUDE.md` D42) :** renouvellement possible **uniquement par
proposition INFLUX**, une fois l'affaire précédente dans un état terminal, avec un lien vers la
mise en relation d'origine.

> ✅ **Arbitrage du fondateur (2026-09-24) : proposition INFLUX uniquement.** Reporté dans
> `CLAUDE.md` D42, `13` RG104bis, `14` Q8, `04` §12.11. À préciser : définition de « terminée » et
> champ de lien.

---

## 3. Oublis : tranchés par le fondateur le 2026-09-24

Les six oublis ont été soumis au fondateur le même jour. **Les six arbitrages suivent la
recommandation.**

| # | Oubli | Pourquoi il comptait | Arbitrage du fondateur | Reporté dans |
|---|---|---|---|---|
| **D52** | **Suivi de l'exécution après signature** | Promis par `00` §6.1, spécifié nulle part ; nécessaire pour relancer une commission payée à la confiance et instruire D20 | **Suivi léger par le commercial** dans la fiche d'affaire (dates et lien de publication, validation par la marque), qualificatif « livraison », aucun écran membre | `14` RG105 à RG108, `04` §12.11, `00` §6.1 et §6.3, `CLAUDE.md` §4.3 |
| **D53** | **Affaires hors plateforme, relations préexistantes, mesure de départ** | Les affaires faites au téléphone restaient invisibles et l'objectif du pilote n'avait aucun point de comparaison | **Mesure de départ + registre des relations préexistantes** ; aucune affaire hors plateforme (RG2bis maintenue) ; le réseau du fondateur entre par invitation puis proposition INFLUX | `14` RG109 à RG112, `00` §5, `04` §12.11, `CLAUDE.md` §14.4 |
| **D54** | **Invitation nominative par un commercial** | Aucun moyen de faire entrer le réseau du fondateur avec un commercial responsable pré-attribué | **Lien d'invitation nominatif** ; inscription faite par la personne ; aucun profil pré-rempli ; e-mail d'invitation soumis aux règles de la saisie libre (D35) | `05` RG116 à RG119, `16` §E, `04` §12.11, `00` §6.3, `CLAUDE.md` §4.3 |
| **D55** | **Source d'acquisition à l'inscription** | Aucun canal d'acquisition mesurable | **UTM de la session d'inscription + question facultative**, sans traceur entre visites ; transmis à Brevo, jamais à Apollo | `05` RG120 à RG123, `04` §12.11, `docs/landing-page/11`, `CLAUDE.md` §8 |
| **D56** | **Protection de la démonstration** | Une URL de démo partagée était ouverte à tous | **URL protégée par mot de passe**, bandeau « données fictives », non indexée, jamais sur le domaine de production | `CLAUDE.md` §16.2, `implementation_plan.md` mission 6.4 |
| **D57** | **Politique de sauvegarde du produit réel** | Seule une répétition de restauration était prévue au Lot 6 | **Perte maximale de quelques minutes** : restauration à un instant donné, tests réguliers, purges RGPD rejouées après restauration | `02` §19, `18` limite n° 12, `CLAUDE.md` §14.3 |

**Ce qui reste à produire** : les critères d'acceptation et les écrans des additifs (`product-owner`,
`expert-ux`), le schéma (`expert-database`, `04` §12.11), l'avis d'`expert-conformite-rgpd` (veto) sur
le registre des relations préexistantes, l'invitation et l'absence de traceur, et le **relevé de
l'activité de départ par le fondateur** avant le pilote.

---

## 4. Questions ouvertes des spécifications

Les documents de spécification portent **environ 156 questions ouvertes**, chacune avec une
hypothèse d'attente, un arbitre et une échéance. Elles ne sont pas recopiées ici, pour ne pas créer
une seconde source de vérité.

| Document | Questions | Document | Questions |
|---|---|---|---|
| `04` (§12, points à valider) | 3 + tableaux §12.5 à §12.10 | `11` | 14 |
| `05` | 13 | `12` | 11 |
| `06` | 10 | `13` | 12 |
| `07` | 14 | `14` | 13 |
| `08` | 11 | `15` | 15 |
| `09` | 15 | `16` | 13 |
| `10` | 12 | `17` §10, `17b` §7 | points à valider propres |

**Aucune échéance n'est dépassée** : elles se rapportent aux lots du produit réel, qui n'a pas
commencé (D44). Les plus urgentes sont celles qui bloquent la **première mise en ligne (Lot 1)** :
D21, D25, D29 et D33 dans `CLAUDE.md`, et `05` Q1, Q2, Q3, Q7 (base légale et périmètre Apollo,
pays de prospection, fenêtre de non-contournement). S'y ajoutent deux chantiers déjà tranchés : la relecture
des textes de la landing page réécrits le 2026-09-24 (D48) et la mesure de l'activité de départ (D53).

---

## 5. Suites

1. ~~Reporter les arbitrages du fondateur dans `CLAUDE.md` §13 et dans les documents concernés.~~
   Fait le 2026-09-24.
2. ~~Réécrire les textes de la landing page (D48)~~ — fait le 2026-09-24 ; restent la relecture
   `expert-marketing` / `expert-conformite-rgpd` et le détachement de la maquette.
3. ~~Écrire la spécification des apartés (additif de `12`, D47)~~ — fait le 2026-09-24 (`12` §K,
   RG113 à RG146) ; ~~traduction dans le modèle de données~~ — faite le 2026-09-24 (`04` §5.7.1,
   A1, A3 et A4 tranchées ou faites le même jour, `03` aligné ; reste A2 pour
   `expert-cybersecurite`) ; restent le veto `expert-conformite-rgpd` et les
   tests de cloisonnement dans le plan `18` (point 6, tests TA1 à TA8 de `04` §5.7.1).
4. ~~Arbitrer les oublis D52 à D57~~ — fait le 2026-09-24 ; compléter les additifs (critères
   d'acceptation, écrans, schéma) et faire relever l'activité de départ (D53).
5. Corriger dans la maquette les seuls écarts qui faussent la vision (marqués ⚠️ dans
   `implementation_plan.md`).
6. **`testeur` — ajouter les tests de cloisonnement des apartés au plan de test `18`** (`12` RG145,
   RG146 et liste des tests dans les impacts de `12` §K) : cloisonnement par rôle en accès direct à
   la base (CA63), données dérivées (CA61, CA62), refus de l'API (CA64, CA65), journal des lectures
   par canal (CA67, CA68), notifications (CA73, CA74) et export au titre du droit d'accès (CA79).
   Les rattacher à la zone Z1 et aux familles T2 (RLS par rôle) et T5 (journal des lectures),
   les inscrire au « prêt à livrer » du Lot 4 et mettre à jour le total des cas (§3.2). Les tests
   vérifient le résultat — aucune ligne de l'aparté de l'autre partie —, pas le mécanisme, laissé au
   choix d'`expert-database` (politique d'accès aux lignes ou objets séparés).
