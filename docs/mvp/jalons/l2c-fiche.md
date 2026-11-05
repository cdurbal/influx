# Jalon L2C — File 1 : un commercial valide ou refuse un profil marque
> Source : `jalons/lot2-plan.md` l. 27, reliquat l. 43 · 2026-11-03 · Statut : à valider

## Objectif et périmètre

Un commercial ouvre une entrée (ouvrir = prendre en charge), lit le profil, publie ou refuse avec un
motif typé ; la marque reçoit le message dans sa langue ; à la première publication, `profile.completed`
part vers Brevo et Apollo, enrichi. Sur un profil publié, une modification d'un champ modéré repasse en
file et la version validée reste la ligne vivante (`06` RG9).

Reliquat traité : PLK-1, PLS-7 (J9S-7 déjà fait, `HealthErrors.tsx:74-80`), L2BS-1, L2BS-7, L2BS-8,
L2BT-3, L2BT-7, et le risque de L2B : « Mes informations » renomme sans examen.

**Ne change pas :** files 2 à 16 ; aucun badge, bloc 4 ni raison sociale (L2E) ; aucune recherche ni
campagne (RG8, RG24 côté serveur au Lot 3) ; aucun aperçu « ce que voit un créateur » (`06` §H) ;
aucun montant, taux ni tarif (D48, D78) ; budget toujours suspendu (réponse A du L2B) ; suspension et
levée (Lot 5) ; correction d'un champ par un agent (RG71, CA22 : Lot 5, réponse 1) ; actions de masse (la file 1 n'en a pas) ; notes internes, blocs ④ à ⑦ et ⑨ de la fiche
(lots 3 à 5) ; alertes AL1, AL5, AL38 (L2G, « alertes du lot »).

## Invariants

1. **RG6.** Seule une décision humaine publie : aucune tâche, aucun délai, aucun membre, aucun rôle
   hors `agent`, `admin` n'exécute la transition. Test : droits refusés rôle par rôle.
2. **Verrou en base.** Transition conditionnelle atomique (`04` l. 2465-2480), jamais `SELECT` puis
   `UPDATE` ; deux prises simultanées : un gagnant, l'autre reçoit le nom du titulaire, en lecture
   seule, sans écran d'erreur (`15` C1, C2, `06` CA17). Verrou expiré : plus de décision (CA18).
3. **Deux issues, motif fermé** (`06` RG65, RG66 ; `15` C6, C7). Refus sans motif refusé par le
   serveur et par la base ; « Autre » exige son texte. Le message montré à l'agent est celui envoyé.
4. **Décision liée à la version examinée** (L2BS-1). Un jeton de version change à toute écriture ;
   jeton périmé : décision refusée, l'agent relit (`06` cas limite l. 668). Obligatoires recontrôlés
   par `profiles.advertiser_missing_required_fields` (`0203`) à la publication.
5. **Gel en base** (L2BS-1). Un membre ne peut, en contournant l'API, ni écrire un champ modéré d'un
   profil publié, ni écrire quoi que ce soit d'un profil suspendu : colonnes, listes (`0202`
   l. 328-332, 358-369), logo (`0204` l. 314-342), nom (`0122`).
6. **RG9, `04` l. 1426-1480.** La ligne vivante porte toujours la dernière version validée ; une
   valeur modérée attend dans `profile_field_revisions` ; un champ à effet immédiat s'applique tout de
   suite. Approbation : valeur appliquée et révision close dans la même transaction.
7. **Journal.** Prise, relâche, levée forcée, décision, ouverture d'une entrée et lecture
   des coordonnées (L2BS-7) : une ligne nominative chaînée ; codes dans `audit.event_types`.
8. **Leads** (`06` RG78, CA40 à CA43). `profile.completed` une seule fois par compte, `lead.updated`
   ensuite, dans la transaction du fait ; charge réduite aux identifiants ; consentement relu à la
   consommation ; Brevo ou Apollo en panne ne bloque jamais une publication.
9. **RG80, `07` RG108 transposé.** Liste fermée de sortie : ni raison sociale, ni immatriculation, ni
   note, ni coordonnée de l'interlocuteur, ni chiffre exact ; tout champ hors liste refuse l'appel.
   Champ absent = vide (RG81).
10. **E-mails** (D69, `16` l. 794). Rédigés par INFLUX depuis `locales/{fr,en}/email.json`, P1, sans
    modèle Brevo ni lien (RG158 étendu), une décision = un e-mail, dans la langue du compte.
11. **C(3), `15` RG36.** Un interne ne voit ni ne traite une entrée de son propre compte.
12. **D45, D46.** Aucune coordonnée servie à un membre ; `advertiser_contact_details` n'apparaît que
    dans la vue de décision et la fiche internes, jamais dans la liste.
13. **Sorties fermées** (`02`, `18` T14). Schéma zod de réponse sur chaque route ; identifiant inconnu,
    interne ou propre : même code, même corps. Pagination plafonnée, pas de défilement infini (RG34) ;
    l'adresse porte des codes, aucune donnée personnelle (RG121).
14. **Données, pas constantes** (`15` RG26, RG38). File et délai en table (`0129`) ; `sla_due_at` figé à
    l'entrée, calculé une seule fois par une fonction déterministe (`04` l. 2228-2252) ; décision
    tardive possible et marquée (C8).
15. **Base.** RLS activée et forcée, `REVOKE` à `public`, `anon`, `authenticated`, `service_role` ; ligne
    `expected-rights.ts` ; `SECURITY DEFINER` inscrit en `03` P7 ; aucun `drizzle-kit push`.
16. **Écrans.** KEO par tokens seuls, quatre états (RG117), clavier `15` RG114, couleur jamais seule ;
    libellés backoffice dans `messages/fr.ts` (D36), membres en FR et EN ; aucune logique métier dans un
    composant.
17. **Budget e2e.** Au plus 20 s ajoutées (`21` §2.3), un cas par page et par langue, planchers jamais
    baissés. Ligne 14 avant le premier écran.

## Lectures

| Commit | Tranches | Code |
|---|---|---|
| 01 | Cette fiche § Écarts ; `04` l. 1415-1484, 2465-2480, 4831-4837, 6127-6129 ; `06` l. 174-185, 481-531 ; `15` l. 268-279 ; `17b` l. 516, l. 445-462 | `0203` en-tête ; `0204` l. 104-130 ; `0133` l. 24-27 |
| 02, 03 | `21` l. 149, 158 | `actions-routes.ts` ; `HealthErrors.tsx` |
| 04 | `15` l. 292, 351-354 ; `04` l. 2228-2252, 4831-4837 ; `06` l. 161-164 | `0129` ; `tm3-backoffice-catalogue.test.ts:147` |
| 05, 06 | `04` l. 315-318, 1433-1480 ; `06` l. 174-185, 499-511 ; `l2c/file.md` | `0202`, `0203`, `0204`, `0122` l. 97-100 |
| 07 | `04` l. 2465-2480, l. 664 ; `06` l. 488-494, 515-517, 573-576 ; `15` l. 272-279, 338-340 ; `03` l. 212, 383 | `0203` l. 179-283 ; `0104` l. 392-416 |
| 09 | `16` l. 794, 1011, 1051 ; `06` l. 499-508 | `connectors/brevo/index.ts:97-114` ; `identity/data-request-received-email.ts` |
| 10 | `06` l. 578-589 ; `16` l. 1465 ; `05` l. 504 | `connectors/brevo/mapping.ts:11-34, 100-125` ; `connectors/apollo/mapping.ts:19-24` |
| 11, 12 | `15` l. 272-279, 281, 322, 330, 335 ; `17b` l. 382-462 ; `06` l. 236, 261, 519 | `accounts-routes.ts` ; `route-models.ts:26-33` ; `0132` l. 69 |
| 13, 15 | `06` l. 174-185, 607-609 ; `17` l. 672 et suiv. ; `17` l. 1776 (nom) | `profiles/brand-profile.ts:48-52, :190, :218` ; `identity/account-routes.ts:205-225` ; `ProfileStateNotice.tsx` ; `brand-profile-view.ts` |
| 16, 17 | `17b` l. 111-150, 264-364, 365-552, 1824-1888, 1940, 1977 ; `15` l. 908-928 ; skill `backoffice-ops` | `bo-nav.ts:22-58` ; `DenseTableRegion.tsx` ; `bo-classes.ts` ; `HomeScreen.tsx` |
| 18 | `17b` l. 1046-1121 ; `15` l. 360-400 | `AccountScreen.tsx` |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| 01 | *(arbitrage, sans titre)* | `l2c/file.md` : A1 à A10 ci-dessous | — |
| 02 | `refactor(api): backoffice action routes split by subdomain` | PLK-1 : ≤ 600 lignes par fichier, comportement constant | `t14-backoffice-actions-route`, `t14-backoffice-route-inventory` inchangés |
| 03 | `fix(backoffice): unverified note on the browser stack and page` | PLS-7 | `health-errors-ui.test.ts` |
| 04 | `feat(db): profiles_advertiser queue, delay and claim expiry` | I-4. File 1, SLA, `operational_settings`, calcul de l'échéance | `tm3-backoffice-catalogue`, T2 |
| 05 | `feat(db): moderated fields, field revisions and review entries` | I-4. `0207` de `04`, motifs, entrée de file | `profiles-brand-review.test.ts`, T2 |
| 06 | `feat(db): published and suspended brand profiles frozen in the database` | I-4. L2BS-1, portes membres de RG9 | même fichier ; L2BT-3, L2BT-7 |
| 07 | `feat(db): claim, release and decision on a brand review entry` | I-4. Verrou, publier, refuser, codes, sorties leads | `profiles-brand-decision.test.ts` |
| 08 | *(retiré, réponse 1)* | RG71 reporté au Lot 5 ; numéro gardé pour ne pas décaler les renvois | — |
| 09 | `feat(worker): brand decision e-mails` | `profile.decision` | `tm1-brevo-connector`, rendu FR, EN |
| 10 | `feat(worker): brand attributes to Brevo and Apollo` | RG79 à RG81 ; `16` §M4 amendé | `tm1-brevo-connector`, `tm1-apollo-connector` |
| 11 | `feat(api): brand review queue list and entry opening` | Liste, compteurs, ouverture, alertes RG19, RG25, RG70, L2BS-8, L2BS-7 | `t14-backoffice-queue-route.test.ts` |
| 12 | `feat(api): brand review decisions` | Publier, refuser, relâcher, prolonger, lever | même fichier |
| 13 | `feat(api): brand edits on a published profile go through review` | RG9 côté API, nom, logo, motif servi | `profiles-brand-route`, `profiles-brand-logo-route`, `tm1-member-account-route` |
| 14 | *(arbitrage, sans titre)* | `l2c/e2e.md` : éclats chiffrés, appliqués si le gain est réel (réponse 2) ; borne de 8 min inchangée | commit `ci(e2e)` ajouté si retenu |
| 14a | `ci(e2e): browser journeys in two shards with a merged report` | `l2c/e2e.md` : 2 éclats `--project=chromium`, fusion (TK3.1, plancher) | `--list` 131/94 ; 228 cas réunis |
| 15 | `feat(web): brand profile published, under review and refused states` | M2, accueil marque | `brand-profile.spec.ts` (≤ 4 s) |
| 16 | `feat(backoffice): queue template and brand profile queue` | Gabarit de liste, entrée « Files », compteurs | `backoffice-queue.spec.ts` (≤ 6 s) |
| 17 | `feat(backoffice): brand review decision screen` | Gabarit de décision, motifs, raccourcis, enchaînement | même spec (≤ 8 s) |
| 18 | `feat(backoffice): brand blocks on the account record` | Blocs ②, ③, sans correction | même spec (≤ 2 s) |
| 18a | `feat(db): journaled agent read of a brand logo` | I-4. `queue.logo_read` (décision du fondateur) | `profiles-brand-decision`, T2, T3 |
| 18b | `feat(backoffice): brand logo shown on the decision screen` | Route de lecture, image en `blob:` | `t14-backoffice-queue-route`, `backoffice-queue.spec.ts` (≤ 2 s) |
| 18c | `feat(backoffice): queue paging and period filter through a POST search` | Page 2, « Période » (décision du fondateur) | mêmes fichiers (≤ 2 s) |
| 19 | *(fondateur, sans titre)* | Recette `staging` | — |

## Tests

| Identifiant | Niveau | Ce qu'il prouve | Plancher |
|---|---|---|---|
| T2 | db | Chaque table et fonction neuve, rôle par rôle ; `anon`, `authenticated`, `service_role` à zéro | +1 ligne par objet |
| T14.1 à T14.4 | route | Entrée d'autrui, inconnue, propre compte : même code, même corps ; créateur et marque sans route | 4 cas par route |
| L2C-V1 à V4 | db | `Promise.all` de deux prises : un gagnant ; expiration ; relâche ; levée forcée journalisée | 4 |
| L2C-G1 à G5 | db | Gel : colonne modérée, liste, logo, nom, suspendu, par rôle direct sans l'API | 5 |
| L2C-D1 à D6 | db | Publier, refuser, motif absent, jeton périmé, obligatoire manquant, non-titulaire | 6 |
| CA15, CA16 | route | Modéré repasse en file ; immédiat appliqué | 2 |
| CA17 à CA21 | route, db | `06` l. 796-812 | 5 |
| CA40 à CA43 | db, connecteur | `profile.completed` unique ; sans consentement : ignoré hors compteur ; RG80 ; panne | 4 |
| L2BT-3, L2BT-7 | db | Double soumission ; `legal_name` et `country` | 3 |
| e2e file 1 | navigateur | Liste → ouverture → publier ; refuser avec motif ; second agent en lecture seule ; hors délai écrit | ≤ 16 s |
| e2e M2 | navigateur | Publié, révision en cours, refusé avec son motif, FR et EN | ≤ 4 s |

D76 : base touchée, fichiers du domaine ; migration ou politique, **toute la suite base**. Tout écran ou
module de classes neuf : aussi `test:artifacts` et `charter-headings` (L2BT-8, trois CI rouges au L2B).

## Critère de fin

- [ ] Sur `staging` : soumis → pris en charge → publié, puis soumis → refusé, puis révision d'un champ modéré repassée en file. *Preuve : ligne 19, lecture seule de `audit.audit_events`.*
- [ ] Verrou : deux prises simultanées, un seul gagnant. *Preuve : L2C-V1, vu rouge par mutation.*
- [ ] L2BS-1 soldé. *Preuve : L2C-G1 à G5 ; ligne retirée de `21` §8.*
- [ ] `profile.completed` chez Brevo sur `staging`, avec les attributs ; RG80 et RG108 tenus. *Preuve : CA40 à CA42 ; ligne `done` de `leads.outbox_events` ; attributs lus sur le contact.*
- [ ] E-mail de décision reçu en FR et en EN. *Preuve : ligne 19.*
- [ ] PLK-1, PLS-7, L2BS-7, L2BS-8, L2BT-3, L2BT-7 soldés ou reportés nommément dans `21` §8.
- [ ] `pnpm check` puis `pnpm test:e2e` verts trois fois, CI verte, durée e2e ajoutée ≤ 20 s (`run.md`) ; « Browser journeys » selon `l2c/e2e.md`.
- [ ] Revue `testeur` et `expert-cybersecurite` soldée, attestation pour 04 à 07, 09a, 10, 18a.

## Écarts, décisions ouvertes, risques

**À trancher par la ligne 01 (`architecte`), recommandation écrite ici, aucune hypothèse dans le code :**

- **A1 — Objet de la file.** `04` l. 1457 pose le verrou sur chaque révision, mais `06` RG63 et `17b`
  l. 516 listent un profil avec ses champs modifiés, et une première soumission n'a pas de révision.
  *Recommandé :* `profiles.advertiser_review_entries`, une entrée ouverte par compte (première
  soumission ou révision), portant verrou, échéance, jeton ; révisions rattachées ; décision globale.
- **A2 — État pendant une révision.** `06` RG9, CA15 : « repasse en attente » ; `04` l. 1476 : reste
  `published`. *Recommandé :* `04` (seule lecture compatible avec une version visible) ; `06` amendé ;
  `brandProfile.status.pendingWithPublished` servi d'après la révision.
- **A3 — Écriture pendant l'examen.** `EDITABLE_STATUSES` autorise `pending_review`. *Recommandé :*
  écriture permise, jeton changé, décision refusée puis relue ; révision en attente remplacée
  (index unique), retour à la valeur validée = `withdrawn` ; mention « modifié après examen ».
- **A4 — Liste modérée.** Codes de `moderated_fields` ; `secteur` de RG9 couvre-t-il les secteurs
  secondaires ? logo : état `in_review` ajouté à `brand_logo_state`, ancien logo actif jusqu'à décision ?
  *Recommandé :* secteur principal seul (RG13 : liste fermée, sans texte) ; état ajouté.
- **A5 — Propriétaire des fonctions.** Liste fermée `03` P7. *Recommandé :* un rôle dédié
  `influx_moderation_definer` plutôt qu'élargir `influx_identity_definer` ; à signer en revue.
- **A6 — Motifs.** `profiles.advertiser_rejection_reasons` (`04` l. 315). « Autre » : `06` RG66 envoie un
  message rédigé par l'agent, `17b` §4.3 parle d'un commentaire interne. *Recommandé :* deux champs
  bornés (message au membre, commentaire interne), détecteur RG19 appliqué au message. « Contenu illicite » : message neutre
  unique, relu en porte de production (`21` §5.8).
- **A7 — Détection.** RG19, RG25, RG70, homographes (L2BS-8). *Recommandé :* fonctions pures de
  `packages/domain`, calculées à la lecture, jamais stockées ; domaine non ASCII ou `xn--` = alerte, sans
  refus.
- **A8 — Dépossession (C4, C(20)).** Comment informer le titulaire ? *Recommandé :* bandeau à sa
  prochaine action et `platform/internal-email.ts` ; code `queue.claim_forced_release` avancé du Lot 4.
- **A9 — Expiration (C3).** Calculée à la lecture (`claim_expires_at`) ; abandon journalisé par quoi ?
  *Recommandé :* à la prise suivante, plus la tâche périodique existante pour les entrées non reprises.
- **A10 — Adresses.** `/files/profils-marque`, `/files/profils-marque/[id]` ;
  `/v1/bo/queues/profiles-advertiser/...` ; ouverture en `POST` (effet de bord).

**Écarts relevés :**

- **EC-L2C-1** : numéros réels, suivants libres après `0205` (`04` l. 6129) ; relire `ls` au commit, L2D
  peut en prendre.
- **EC-L2C-2** : `backoffice.operational_settings` annoncée en `0306` (`04` l. 6136) et `0503` (`0133` l. 27) ;
  créée ici avec la seule clé `claim_expiry_minutes` (RG38). Écran admin : Lot 5.
- **EC-L2C-3** : la colonne « Raison sociale » de `17b` l. 516 affiche le nom commercial (EC-L2B-3) jusqu'à L2E.
- **EC-L2C-4** : `RG108` du plan vise `07` ; côté marque, c'est `06` RG80, plus l'absence de chiffre exact.
- **EC-L2C-5** : RG71, CA22, `15` RG44 et `03` C(7) reportés au Lot 5 (réponse 1) : aucun code ni e-mail de correction ici ; CA22 inscrit dans `21` §8, « avant production ».
- **EC-L2C-6** : RG72 partiel (badges : L2E, péremption : L2F) ; `Autre` à 10 % : AL38 à L2G.
- **EC-L2C-7** : 15 commits contre 9 estimés : RG9 côté membre et le gel n'étaient pas chiffrés.

**Risques :** « Browser journeys » à 429-481 s pour une borne de 480 s, seuil de 7 min 30 déjà franchi
(ligne 14, réponse 2) ; attributs Brevo à créer sur `staging` avant 10 (D70, sinon l'appel échoue, D67) ; L2D en
parallèle sur les numéros de migration ; `AccountScreen.tsx` à 815 lignes, ne pas l'allonger.

## Réponses du fondateur (2026-11-03)

1. RG71 reporté au Lot 5 : ligne 08 retirée, CA22 en `21` §8.
2. La ligne 14 peut proposer et appliquer des éclats, sans élargir la borne de 8 min.
3. 2026-11-05 : lecture du logo côté agent journalisée (`queue.logo_read`, lignes 18a, 18b) ; page 2 et filtre « Période » par une recherche en `POST` (ligne 18c). Écart de budget e2e : ces lignes s'ajoutent aux 20 s, mesurées à la clôture.

## Revue
