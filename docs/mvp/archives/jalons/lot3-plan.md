# Lot 3 — Campagnes et recherche anonymisée : découpage en jalons
> 2026-11-13 · Claude Code (`/lot-decoupe`, D77) · Statut : **validé par le fondateur le 2026-11-13** (réponses en fin de document ; D38 ouverte)

Sources : `00` §7 (Lot 3) et §9 (mode serré : fil chronologique côté créateur), `21` §7 et §8,
`18` §10 (Lot 3 : T1 rejoué, T14, T15, TM5, TM12, I-9), questions ouvertes et critères de `09`, `10`,
`11`, `04` §5.4, §5.5, §11 (`0303` à `0308` ; `0301` et `0302` pris par L3A, numéros indicatifs), D78 étendue le 2026-11-13.

**Frontière avec le Lot 4 (tranchée le 2026-11-13, question 1)** : la candidature (`11` §E à §J, C7, C8) et
l'action « Demander une mise en relation » (`10` RG51) créent une `matching.introductions` (`0401`) :
elles arrivent au Lot 4 avec la file 8, comme l'exclusion « déjà en relation » (`10` CA22). Le Lot 3
livre la campagne publiée, sa lecture par le créateur, la recherche, les sélections et la vue identifiée.

## Préalables
| Décision ou question | Arbitre | Bloque quel jalon | État |
|---|---|---|---|
| D38 : masse critique, ouverture globale ou par thématique (`10` Q9) | Fondateur + `chef-de-projet` | Clôture du lot (`18` §10, non automatisable) ; mécanisme livré interrupteur fermé (L3E, L3G) | Ouverte |
| Valeurs de `reference.price_bands` par devise (budget par créateur, valeur de dotation) et devises proposées | Fondateur + `expert-paiement-facturation` | L3B (référentiel, L2AT-5) | Méthode tranchée 2026-11-13 (question 2) : grille par devise proposée par `expert-paiement-facturation`, validée par le fondateur avant L3B ; nets nuls (D48) |
| `09` Q16 : rangement de la tranche de budget (`campaign_price_bands`, contrainte reformulée, devise sans tranche refusée) | `expert-database` sous `architecte` | L3B (migration des campagnes) | Hypothèse écrite ; arbitrage en ligne 01 de L3B |
| `10` RG61 et file 9 `team_selection` (`17b` §1.3) : aucune table dans `04` §5.5 | `chef-de-projet` (lot) ; `expert-database` sous `architecte` (rangement) | L3F, L3G | Ouverte ; hypothèse : table et file 9 minimale (prise en charge, clôture motivée), réponse par proposition INFLUX au Lot 4 |
| Frontière Lot 3 / Lot 4 (ci-dessus) | Fondateur + `chef-de-projet` | L3D, L3F | ✅ Tranchée 2026-11-13 (question 1) |
| `10` Q11, RG28 : geste de blocage entre parties (qui, depuis où) | `product-owner` + `expert-conformite-rgpd` | L3E (table `party_blocks`, exclusion) | ✅ 2026-11-13 (question 3) : table et exclusion au Lot 3, geste au Lot 4 depuis la conversation ; silencieux, motif typé (hypothèse de `10` Q11) |
| Skills de plus de 10 Ko hors domaine : `lead-pipeline`, `brevo-campaign` | Fondateur | Aucun | ✅ 2026-11-13 (question 4) : allègement au Lot 5 ; L3C n'en lit que les tranches utiles |
| CI bloquée par la facturation GitHub (L2GT-9, L2D-E2E) | Fondateur | L3A (mesure des éclats) ; chaque push | ✅ Débloquée le 2026-11-13 ; nouveau blocage : arrêt, main rendue au fondateur (au cas par cas) |
| Paramètres en table : `10` Q6 (k = 5), Q12 (12 × 5, 30/h, 200/j, 60 profils/j, froid 2 sur 12) ; `09` Q9 (1 j, 2 j en revue renforcée, D39), Q11 (10 publiées) | Fondateur ; `expert-cybersecurite` + `expert-matching` | Aucun | Hypothèses des specs pour `staging` |
| Cadrages : `10` Q4 (pas de 3e action), Q5 (décompte en tranche), Q8 (profil marque publié requis), Q13 (F24, F25 affichés, filtre en seconde vague) ; `09` Q3 (aucun lien), Q10 (« réservée aux vérifiés » en base, désactivée) ; `11` Q2, Q6 | `product-owner`, `chef-de-projet`, Fondateur | Aucun | Hypothèses des specs |
| Vetos RGPD : `09` Q5 (critère sur la personne : refus), Q6 (7 secteurs sensibles), Q7 (divulgation) ; `10` Q1 (information des créateurs), Q7, Q10 (journal, 12 mois) ; `11` Q12 | `expert-conformite-rgpd` au Lot 6 (D71) | Aucun sur `main` ; porte `production` | Hypothèses des specs |

## Jalons
| ID | Objectif (une phrase) | Spécifications (tranches) | Migrations | Écrans | Tests porteurs | Dépend de | Commits estimés | Critère de fin |
|---|---|---|---|---|---|---|---|---|
| **L3A** | Solder le reliquat « avant le Lot 3 », alléger les skills du domaine, ramener le job base sous 8 min | `21` §8 ; `archives/jalons/l2g/fix-5a.md` (choix A) ; `03` P7 | `0301` : index L2CS-6 ; 55000 à la publication d'un compte non `active` (L2GS-8) | — | Deux éclats base à pile propre ; T1-R tous schémas (L2DS-3) ; aucun `execute` dynamique (L2DS-5) ; T2 | CI débloquée | 7 (dont 2 « dette skill », `sonnet` · `high` : `design-system-influx`, `backoffice-ops`) | Skills ≤ 10 Ko ; éclats ≤ 7 min 30 et job ≤ 8 min en CI ; `0301` sur `staging` ; reliquat L3A soldé |
| **L3B** | Une marque rédige sa campagne (8 blocs, 5 étapes, brouillon permanent) et la soumet | `09` §A à §H, §K ; `17` §4.3 ; `04` §5.4 ; `03` (campagnes) | Campagnes, tables filles, codes `campaign.*` ; `campaign_types`, `price_bands` chargées | M3 (KEO, D74) ; aperçu « ce que voit un créateur » (CA68) | T2 ; T14 ; T16 (CA40) ; textes (RG22, RG48, CA12 à CA17) ; e2e M3 FR/EN | L3A ; `09` Q16 ; `price_bands` | 10 | Sur `staging`, une marque publiée crée, reprend (CA72) et soumet une campagne « à valider » ; tranche absente de toute charge créateur |
| **L3C** | Un commercial valide (une personne en secteur sensible, second avis facultatif, D84 ; clos le 2026-11-17, `archives/jalons/l3c-fiche.md`) ou refuse une campagne ; publiée, elle vit ses états et part vers Brevo | `09` §A (états), §I, CA47 à CA63, CA69 à CA71 ; création et correction par un agent (RG1, RG94, CA60, CA61 ; fiche L3B, réponse 1 du 2026-11-13) ; `17b` §3.8 ; `15` (file 7) ; D81 | Publication (instantané, `campaign_price_bands`, revue renforcée) ; file 7 ; clés d'exploitation (`0306`) | File 7 ; fiche campagne au backoffice ; états côté marque | **TM5** (transitions) ; T14 ; verrou de file ; 2V ; `campaign.published` (CA69 à CA71) ; e2e file 7 | L3B | 9 | Soumise → prise en charge → publiée (instantané), pause, clôture à date limite par le worker ; « alcool » exige deux agents ; Brevo sans texte ni tranche |
| **L3D** | Le créateur parcourt le fil chronologique des campagnes ouvertes et lit une fiche sans montant | `11` §A, §B, §C (tri, pagination), §D, §K ; `09` §J ; `17` §5.5, §5.6 (C6 sans C7) ; `00` §9 point 1 | — (lecture de l'instantané publié) | C5, C6 | T1 côté créateur (`11` CA4, CA5 : ni coordonnée de marque ni montant) ; T14 ; T15 (fil, CA18) ; e2e C5, C6 | L3C | 5 | Sur `staging`, un créateur publié voit les campagnes ouvertes, jamais un secteur refusé ni une marque suspendue ; aucun montant dans la charge brute |
| **L3E** | L'API de recherche anonymisée répond : filtres SQL, exclusions, tri explicable, k-anonymat, plafonds, journal | `10` §A à §D, §F, §G, §I, §J ; `04` §5.5 ; `03` (search) ; skill `matching-spec` | Journal (requêtes, impressions, raisons, sélections) ; réglages et versions de facettes, `supply_counters` ; `party_blocks` | — | **T1 rejoué** sur les routes de recherche (L2GS-8) ; TM12.1 à TM12.4 ; T15.2 ; T2 ; I-9 | L3A | 9 | Page anonyme triée, explication sans chiffre exact (CA3, CA4), 4 résultats → aucun, page 6 refusée, 31e recherche/h → 429, recherche journalisée |
| **L3F** | La marque cherche, ouvre un profil anonyme (portfolio compris) et construit ses sélections | `10` §B, §E, §K ; `17` §4.4 ; D82 (7), E1-8 ; `10` RG61 | Demande de sélection (selon arbitrage) | M4 ; profil anonyme ; sélections | T1.5, T9 (lecture annonceur) ; T14 ; T15.2 (détail) ; e2e M4 FR/EN, 375 et 1 440 | L3E ; L3C (CA33) | 9 | Interrupteur ouvert : une marque filtre, lit l'explication, ajoute 3 créateurs à une sélection de sa campagne, demande une sélection ; fermé : critères et message seuls (CA59) |
| **L3G** | Le commercial trouve en vue identifiée les créateurs compatibles d'une campagne ; le lot est prêt à livrer. **En tête** (décidé le 2026-11-20, § L3G ci-dessous) : 00a, 00b, 00c (D85), seuils et fonction d'AL21 | `10` §H, CA55 à CA62, RG61.1 à RG61.6, CA39.1 à CA39.5, CA45, CA46 ; `17b` §3.3, file 9 ; `18` §10 (Lot 3) | `0327` (00b) ; seuils et fonction d'AL21 (même migration ou la suivante) ; photographie de la sélection jointe ; lectures journalisées de la vue identifiée (si `04` l'exige) | Vue identifiée ; « créateurs compatibles » pré-rempli depuis le brief ; sélection multiple ; file 9 (sélection jointe) ; réglages admin ; lots front de L3FU-6 à -14 | TM12.5 ; CA58 ; T14 ; calcul quotidien et alerte D38 (CA60) ; suite complète | L3C, L3F | 9 | TM12 vert ; sur trois campagnes de `staging`, compatibles trouvés en moins de 30 s (mesure dans `run.md`) ; D38 tranchée ; revue attestée |

Total : 7 jalons, environ 58 commits. L3E peut suivre L3A sans attendre L3B à L3D ; ordre recommandé
A, B, C, D, E, F, G (un seul fil de travail).

## L3G — reprises décidées le 2026-11-20 (sur délégation du fondateur)
**En tête (≈ 1,5 j, `architecte`, D85 ; SHA de 00a à 00c exigés avant production) :**
- **00a** (0,5 j, `expert-database` / `testeur`, d'abord, sur le code actuel) : `apps/api/db-tests/search-door-concurrency.test.ts`, utilitaire à deux connexions committées (A passe la Nième écriture sans committer ; attendre B en attente par `pg_locks` `granted = false` ; A committe ; B reçoit le refus ; pas de `Promise.all`) : 60e ouverture (`0323`), `listsPerAccount`, `itemsPerList`, 5e demande (`0325`), porte de recherche (`0319`). Solde L3FT-1.
- **00b** (migration `0327`, `expert-database` ; relecture `expert-cybersecurite`, `testeur` ; toute la suite base) : L3FS-1, `open_creator_profile` et `read_creator_visual` lancent moteur et recherche d'impression même alias introuvable (comme `0324` l. 336-340), court-circuit de `0323` l. 496 retiré, test par `track_functions = 'pl'` et `pg_stat_xact_user_functions` (moteur appelé une fois : alias inconnu, exclu ou visible) ; L3FS-2, `remove_from_shortlist` par `shortlist_creator()`, `itemsPerList` compte toujours toutes les lignes, cas EC-L3F-04-4 inversé (`search-shortlists.test.ts` l. 1195) ; L3FS-3 (SQL), moteur avant le verrou dans `add_to_shortlist` et `set_shortlist_note` (relecture sous verrou, relance si la campagne a changé), pré-contrôle du seau sans verrou dans `open_creator_profile` puis verrou, recompte, insertion, `lock_timeout = '1s'` sur `0314`, `0319`, `0323`, `0324`, `0325`.
- **Seuils et fonction d'AL21** (L3ES-3, L3FS-9 ; même migration que 00b ou la suivante, au choix de `/jalon-prepare l3g` ; jamais d'écriture directe sur `staging`) : `update backoffice.alert_definitions set threshold_value = threshold_value || '{"refinement_searches":8,"refinement_blocked":3,"aspiration_min_opens_per_account":20}' where code = 'AL21';` (valeurs neuves à droite) ; fonction recréée (`0326` l. 256-309 : somme et liste réduites aux comptes d'au moins 20 ouvertures, 1 à 2 h, `expert-database`) ; constante `STAGING` de `apps/api/db-tests/search-abuse-alerts.test.ts` mise à jour.
- **00c** (API, après 00b, `dev-react-node` ; relecture `expert-cybersecurite`, `testeur`) : six routes d'écriture dans `MEMBER_ROUTE_ADDRESS_RATES` (POST `/v1/me/shortlists` 10/min ; PUT, DELETE `/:id` 30 ; PUT, DELETE `items/:alias` 60 ; PUT `note` 30 ; hypothèses `staging`) ; 55P03 → 429 `rate_limited`, `Retry-After: 1`, gestionnaire commun de `src/platform/` ; pool de 10 inchangé.
- **EC-L3G-1** (amende `archives/jalons/l3f/modele.md` §5, à valider par `product-owner`) : un créateur masqué ne se retire pas ; il revient s'il redevient visible ou disparaît avec la liste ; `itemsPerList` compte toutes les lignes, une liste peut sembler pleine à moins de 25 cartes. Risque accepté : la suppression d'un compte créateur libère une place par cascade.

**Seuils internes d'AL21** : les comptes internes comptent (RG50) ; avec la vue identifiée, tout commercial dépasse 150 profils et 80 % du plafond : seuils internes séparés à prévoir.

**File 9 et sélection jointe** (L3FU-9, `product-owner`, option c ; `10` RG61.1 à RG61.6, CA39.1 à CA39.5) : `selection-requests.ts` gagne `shortlistId` nullable ; `search.request_team_selection()` gagne `p_shortlist_id` et une table ou colonne de photographie (`expert-database` sous `architecte`) ; l'écran de la file 9 montre marque, campagne, langue, critères en libellés, message, échéance et « Sélection jointe (n) », chaque créateur avec alias et identité (l'alias seul ne suffit pas), avertissement bloquant si bloqué par cette marque ou dépublié (RG71), lien vers la vue identifiée avec consultation journalisée nominativement (RG78), prise en charge et clôture motivée, aucun bouton « proposer » avant le Lot 4 (RG55). Côté marque, l'anonymat ne change pas. Conformité au Lot 6 (`expert-conformite-rgpd`) : export marque en alias seuls, effacement en cascade à la suppression d'un compte créateur, conservation 12 mois. Restent : Q1 transmettre les notes (`product-owner`, après retour des commerciaux, hors périmètre) ; Q2 pré-remplir la campagne de la demande depuis la sélection (proposé oui, à valider par `expert-ux`).

**Lots front** (`expert-ux`, ≈ 2,5 j, rien au 6bis ; tokens KEO seuls, WCAG AA, FR/EN, aucun montant, D78) :
- **« Ma sélection »** (en tête du front, 0,5 j) : L3FU-14, une région `role="status"` masquée dans le panneau, alimentée par `add` et `drop`, `panel.added` / `panel.removed` (« {name} ajouté à votre sélection « {list} » ({count, plural, =0 {aucun créateur} one {# créateur} other {# créateurs}}). » / « {name} added to your selection “{list}” (…). ») ; L3FU-11, dès `lg`, en tête de la colonne collante des filtres, « Ma sélection privée (n) » et lien vers le panneau avec focus, sans texte nouveau ; L3FU-8, barre sous `lg` : mention « privée », sélection affichée, créateurs, lien « Mes sélections », puis « Nouvelle sélection » repliée dans un `<details>`, `--size-selection-panel-max` sur toute la barre ouverte, `panel.close` « Masquer ma sélection » / « Hide my selection » ; passes axe.
- **« Région en noms »** (2-3 h, avant production) : L3FU-6, noms des 89 régions de `reference.regions` (FR, GB, US, CA, AU, `0201`) en `region.*` (ISO 3166-2, CLDR fr/en, sans dépendance), `regionRowOf` dans `shortlists-view.ts`, `profile.regionValue` « {region}, {country} », code sans nom « {pays} ({code}) » ; solde EC-L3F-11-2.
- **« Demande et filtres »** (sur la ligne de la file 9) : L3FU-12, `key` de `SearchFiltersForm` sur `query.filters` seul, le brouillon survit au tri et à la campagne ; L3FU-10, marque non publiée : avertissement en tête, récapitulatif des critères gardé, formulaire retiré, `selectionRequest.notPublished` « Publiez d'abord votre profil de marque : une demande ne peut être envoyée qu'une fois votre profil publié. » / « Publish your brand profile first: a request can only be sent once your profile is published. » ; L3FU-9, carte « Profils de votre sélection « {name} » joints à la demande ({count}) », `lists.explain` mis à jour.
- **« Carte D61 »** (0,5-1 j, ligne dédiée, **validation du fondateur à la recette**, avant que la vue identifiée ne recopie la ligne de réseau, au plus tard Lot 6) : L3FU-7, la ligne de réseau s'ouvre par « réseau · communauté · rythme · commentaires » puis badges, engagement, portée, chiffres exacts ; clés `preview.line.*`, `CreatorCardView.tsx` ; exemple « Instagram · 10 000 à 49 999 abonnés · Plusieurs fois par semaine · 50 à 199 commentaires par publication ».
- **Fin de série** : L3FU-13, passes axe réparties avec chaque correctif, reste en dernière ligne front (résultats à 375 px, « Mes sélections » à 375 px avant suppression).

**Revue** : groupée `expert-cybersecurite` et `testeur` en fin de L3G, attestation I-4.

## Reliquat repris (`21` §8)
| # | Jalon qui le traite |
|---|---|
| L2D-E2E (job base en deux éclats, `fix-5a` choix A) | L3A, avant tout ajout à la suite base |
| L2CS-6, L2DS-3, L2DS-5 | L3A |
| L2GS-8 | L3A (55000 à la publication) ; L3E (filtre `published`, `is_searchable`, compte `active` en SQL, cas T1 et T15) |
| L2GS-5 (avant toute porte neuve de `influx_creator_profile_definer`) | L3E, si la recherche en ajoute une |
| L2AT-5 (contiguïté des `price_bands` au chargement) | L3B |
| EC-L2G-16 (lecture annonceur du portfolio, D82 (7), E1-8) | L3F |
| T15.2 (« plus tard », Lot 3) | L3E (recherche), L3F (détail de profil) |
| F3 (« plus tard », Lot 3 ; `archives/jalons/j9-fiche.md` l. 46, sans définition retrouvée) | L3A : retrouver et affecter, sinon question au fondateur |
| L2DS-6 (toute migration de bornes de tranches) | Aucun : le lot ne modifie aucune borne d'audience, de rythme ni de commentaires |
| L2DT-5, L2DT-6 (avant production, même fichier que T1) | L3E, si la ligne T1 le permet |
| DS-flaky | Surveillé à chaque clôture |
| L3FT-1, L3FS-1 à L3FS-3, L3FS-9, L3ES-3 et L3F-AL21, L3FU-6 à L3FU-14 (décidés le 2026-11-20) | L3G (§ L3G ci-dessus) |

## Risques et budget
- **e2e** : cible de 20 s par jalon gardée ; M3 (L3B) et M4 (L3F) la dépasseront (≈ 25 s chacun) ;
  états préparés par l'API dès la fiche. L3C, L3D, L3G ≈ 15 s. Total ≈ + 100 s sur 507 à 566 s :
  un éclat e2e de plus probablement nécessaire avant L3F (arbitrage `integrateur` à la fiche).
- **Base** : L3A ramène le job sous 8 min ; le lot ajoute ≈ 60 à 90 s (droits des campagnes, T1,
  TM12) : seuil d'alerte relevé à chaque clôture.
- **Invariants exposés** : anonymisation (charge brute des recherches, profils, explications et images
  de portfolio ; décompte en tranche ; alias aléatoire) ; RLS (aucun `GRANT` d'identité au rôle
  annonceur, vue identifiée refusée en base) ; D45 (la demande de sélection n'ouvre aucune
  conversation) ; D46 (aucun lien ni adresse dans un texte de campagne, aucune coordonnée de marque au
  créateur) ; D48 et D78 (aucun montant côté créateur, tranche vue de la marque et des agents seuls,
  T16) ; export interdit à tous (TM12.3) ; journalisation des recherches et de la vue identifiée.
- **Valeur du lot** : la mesure des 30 s exige des données synthétiques crédibles sur `staging`
  (≥ 30 profils publiés, 3 campagnes) : semées avant L3G ; k = 5 vide l'écran sous ce volume.

## Questions au fondateur
1. Frontière : candidature et « Demander une mise en relation » au Lot 4, la carte du Lot 3 n'offrant
   que « Ajouter à ma sélection » et « Demander une sélection à l'équipe INFLUX » ? *Recommandé : oui.*
2. `price_bands` : `expert-paiement-facturation` propose une grille par devise, validée par vous avant
   L3B ? *Recommandé : oui, nets nuls (D48).*
3. Blocage entre parties : table et exclusion au Lot 3, geste au Lot 4 (depuis la conversation) ?
   *Recommandé : oui.*
4. `lead-pipeline` (21 Ko) et `brevo-campaign` (32 Ko) ne servent qu'au commit `campaign.published`
   (L3C) : allègement au Lot 5, où `brevo-campaign` est étendu (`00` §7), lecture bornée d'ici là ?
   *Recommandé : oui.*
5. D38 tranchée avant L3G, interrupteur fermé jusque-là ? Facturation de la CI débloquée avant L3A ?

**Réponses du fondateur (2026-11-13)** : « oui pour les 4 questions » : 1 à 4 retenues comme
recommandé. Question 5 : CI débloquée le 2026-11-13 (blocage de facturation : arrêt, le fondateur
s'en charge) ; D38 reste ouverte.
