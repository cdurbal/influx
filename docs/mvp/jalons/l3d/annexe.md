# Jalon L3D — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au
commit dans `apps/api/db-tests/case-floors.ts` ou `apps/web/e2e/case-floors.ts`, jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3D-T1 | base, e2e | fichiers qui importent `publishAsInflux` ; `brand-campaign-states.spec.ts` | instantanés de fixture réels ; balayage des campagnes publiées des runs antérieurs ; mêmes cas, mêmes attendus | inchangé | 01 |
| L3D-T2 | base | `campaigns-creator-feed.test.ts` | TM5.2 ; RG14 conditions 1 à 4 ; RG11 (profil marque suspendu ou brouillon, compte suspendu) ; CA8 (absente, hors du nombre) ; CA9 (3 j grisée, 8 j absente) ; RG100 ; CA15 à CA17 (même seconde, deux pages) ; plafond de pages ; RG22 ; RG23 ; profil créateur en brouillon admis (RG99) ; T14 en base ; TM5.6 (aucune clé interne, aucun droit `influx_creator` sur `campaigns.*`) ; T2 (objets neufs déclarés) | 22 | 02 |
| L3D-T3 | intégration | `campaign-feed-route.test.ts` | CA3 (clés de la carte exactes) ; CA4 (fiche sans budget total, note ni responsable, pas même vides) ; CA5 ; CA2 ; CA10 ; tris ; logo d'une campagne visible seule ; `no-store` | 14 | 03 |
| L3D-T4 | intégration | `t14-campaign-feed-route.test.ts` | T14.1, T14.3, T14.4 : inconnue, brouillon, à valider, en pause, clôturée, refusée, marque suspendue : même code et même corps ; rôle marque et agent : route inconnue | 6 | 03 |
| L3D-T5 | intégration | `t15-campaign-feed-rate.test.ts` | CA18 ; T15.3 (appel direct), T15.4 (compte et adresse indépendants), T15.5 (refus journalisé avec le compte) ; `Retry-After` | 5 | 03 |
| L3D-T6 | intégration | `t1-anonymisation.test.ts` | T1.2 (routes neuves inventoriées) ; T1.6 côté créateur : titre et brief servis, aucun marqueur de contact de la marque ni du bloc interne ; T1.4 sur les erreurs des routes neuves ; C-1 | +3 | 03 |
| L3D-T7 | unitaire | `tests/member-nav.test.ts` ; vue du fil (`tests/`) | entrée « Campagnes » du créateur (seul attendu changé) ; carte, tri, page, grisée en fonctions pures | +1 ; 6 | 04 |
| L3D-E1 | e2e | `creator-campaigns.spec.ts` | C5 : nombre avant la liste, carte sans montant, grisée sans lien, deux tris, « Voir la suite », fil vide ; axe FR 375, EN 1 440 | 3 | 04 |
| L3D-E2 | e2e | `creator-campaigns.spec.ts` | C6 : fiche, encarts RG32 et RG40, aucun moyen de contact, « n'est plus ouverte » (pause, marque suspendue) ; axe FR 375, EN 1 440 | +2 | 05 |

**Budget e2e : 15 s** (04 ≤ 8 s, 05 ≤ 7 s), médiane de trois, états préparés par l'API et le rôle de
migration (patron `seedCampaignInState`), spec neuve ; mesure dans `run.md` à chaque ligne, selon la
réponse Q2. `brand-campaign.spec.ts` (aperçu) reste vert, attendus inchangés hors encarts. Éclats e2e CI
< 7 min 30 ; quatrième éclat : arbitrage `integrateur` avant L3F (plan l. 58-60). **Base** : éclat le
plus long + contrôle ≤ 8 min.

## Critère de fin
- [ ] Sur `staging`, un créateur publié voit les campagnes ouvertes ; une campagne d'un secteur qu'il
      refuse et celle d'une marque suspendue en sont absentes ; la fiche de cette dernière dit « n'est
      plus ouverte » — preuve : ligne F de `run.md`.
- [ ] Aucun montant, devise, tranche, budget, référence ni coordonnée de marque dans la charge brute
      du fil et de la fiche — preuve : L3D-T3, L3D-T6 verts en CI.
- [ ] TM5.2, TM5.6 (côté créateur), T2, T14, T15 (CA18), T16 verts — preuve : L3D-T2 à T6, run CI.
- [ ] `0314` sur `staging` — preuve : run CI, « Migrate staging » vert.
- [ ] e2e ajoutés ≤ 15 s, éclats CI < 7 min 30, job base ≤ 8 min — preuve : `run.md` § Mesures de clôture.
- [ ] `pnpm check` puis `pnpm test:e2e` verts — preuve : CI (dernier run) et passage local.
- [ ] Revue soldée et attestée (`security-reviewed:`) — preuve : commit d'attestation, contrôle I-4 vert.

## Écarts, décisions ouvertes, risques
- **EC-L3D-1** : `04` §11 l. 6249-6251 et `21` §7 (« la recherche à `0314` ») : L3D prend `0314`, la
  recherche passe à `0315` et suivants ; amendé à la ligne 02 (`04` §11) et à la clôture (`21`, `18` §10).
- **EC-L3D-2** : filtres C1 à C7 (RG27 à RG32, CA11 à CA14) différés au Lot 6bis par le mode serré
  (`00` §9 point 1) ; les deux tris de RG33 sont gardés (plan l. 34 : « tri, pagination »).
- **EC-L3D-3** : sans candidature au Lot 3 (frontière du 2026-11-13) : ni bouton, ni
  `application.blocked.*`, ni `campaign.application.validationNotice` (« au-dessus du bouton »), ni
  état de candidature sur la carte ; CA1 réduit à la lecture du fil par un profil en brouillon.
  - *Relecture `product-owner` de L3DU-1 (2026-11-18) : accord sous réserve, fiche seule.* « depuis INFLUX » et
    « through INFLUX » sont retirés : ils opposent INFLUX à un autre canal et laissent entendre qu'on peut
    candidater ailleurs, auprès de la marque nommée sur la fiche (D45, D46, `CLAUDE.md` §2). La phrase devient
    impersonnelle : elle décrit l'état du produit, pas un refus lié au profil, au pays (L3DU-19) ou à la campagne.
    Texte retenu : FR « La candidature n'est pas encore disponible : cette page sert à découvrir la campagne. » ·
    EN « Applying is not available yet: this page lets you read the campaign. » « pas encore » est admis (pas de
    date, pas de « bientôt ») parce que la notice disparaît au Lot 4, avant toute ouverture au public (Lot 6) ;
    si cet ordre change, elle doit être relue. Pas de montant, de lien, de bouton ni de mention d'un commercial.
  - *Livré par X1 :* clé `campaign.record.noApplication`, notice sur la fiche seule (pas sur le fil), cataloguée dans `09` après la clé `campaign.application.validationNotice`.
- **EC-L3D-4** : mention « réservée aux vérifiés » non servie : option désactivée (`09` Q10),
  colonne non créée (`archives/jalons/l3b/modele.md` §2, -6).
**Réponses du fondateur (2026-11-18)** : « oui aux 3 questions » : Q1 à Q3 retenues comme recommandé.
- **Q1 (tranchée)** : fiche d'une campagne en pause : `09` RG3 et RG8 la disent lisible « en
  pause », RG100 (et `11` RG14, RG24) l'excluent de toute réponse. Retenu : « n'est plus ouverte »
  au Lot 3 (aucun candidat n'existe), lecture des candidats au Lot 4.
- **Q2 (tranchée)** : mesure du budget e2e, L3C-E2E ouvert (`21` §8 l. 228). Retenu : 15 s mesurés
  en CI par spec (rapport de l'éclat), médiane locale indicative.
- **Q3 (tranchée)** : un agent ne reçoit pas le code de connexion d'un créateur de `staging` : la
  preuve du premier critère est la recette du fondateur (ligne F, préparée par l'agent, D70).
- **Hypothèses écrites par A** : valeurs de page, de plafond et de débit (en table, `staging`, revue
  `expert-cybersecurite`) ; conservation du journal de lecture (`11` Q12, veto RGPD au Lot 6, D71).
- **Risques** : base locale grossie (L3C-DB, T9.6-A au bord des 60 s) ; T1 (1 786 lignes) ; D46 sur
  le profil marque lu par un créateur ; DS-flaky surveillé.

## Revue
*(rempli par `/jalon-run` : L3DT-n, L3DS-n, L3DU-n, une ligne chacun)*

### Constats U (ligne U, 2026-11-18, détail : `l3d/ux-constats.md`)
0 bloquant · 4 jalon : L3DU-1 (→ fix-1), L3DU-2 et L3DU-3 (→ fix-2), L3DU-4 (→ fix-3), textes à
valider par le fondateur · 9 avant production · 6 plus tard.
| Id | Gravité | Où | Correctif |
|---|---|---|---|
| L3DU-5 | avant prod. | `CampaignFeedCard.tsx` l. 95-106 ; `campaign-classes.ts` l. 99 | « Candidatures closes » gardé ; badge au-dessus de la marque, icône (`icons.ts`) et date (« Candidatures closes le … ») au lieu de « Candidatures avant le … », pleine opacité, aucun token neuf |
| L3DU-6 | avant prod. | `CampaignFeedCard.tsx` l. 99, 147-153 | deux liens de même cible : le titre reste le lien, le bouton devient l'appui de la carte entière ou disparaît |
| L3DU-7 | avant prod. | `CampaignRecordScreen.tsx` l. 103-112 ; `use-open-campaigns.ts` | retour au fil repart de zéro : tri et rang dans l'adresse |
| L3DU-8 | avant prod. | `CampaignReadBody.tsx` l. 45-57 | les deux encarts avant tout contenu : RG32 sous la section rémunération, RG40 gardé en tête |
| L3DU-9 | avant prod. | `campaign.json` l. 65 ; `09` l. 878 | encart RG32 hors catalogue, mise en garde juridique : relu par `expert-conformite-rgpd` (Lot 6) ou aligné sur le catalogue (fondateur, juriste) |
| L3DU-10 | avant prod. | `CampaignReadBody.tsx` l. 81-112 | marque, logo et badge après les six sections : bloc marque remonté (attendus de l'aperçu ajustés) |
| L3DU-11 | avant prod. | `CampaignFeedCard.tsx` ; `CampaignReadBody.tsx` l. 106-108 | badge de marque : `VerifiedBadge` des deux côtés ; pilule de 70 signes à confirmer en capture 375 (recette F) |
| L3DU-12 | avant prod. | `CampaignRecordScreen.tsx` l. 121-126 | « n'est plus ouverte » : un lien « Voir les campagnes ouvertes », phrase « Elle n'accepte plus de candidatures ou a été retirée. » |
| L3DU-13 | avant prod. | `feed.forbidden`, `record.forbidden` | refus 403 sans issue : lien vers « Mon compte » |
| L3DU-14 | plus tard | `CampaignFeedScreen.tsx` l. 151-159 | « Voir la suite » silencieux : « 12 campagnes affichées sur 14 » dans une zone `status` |
| L3DU-15 | plus tard | tri « Plus récentes » | une carte close peut ouvrir le fil (`11` RG33, à relire par `product-owner`) |
| L3DU-16 | plus tard | nombre (RG35) | compte les closes : nombre d'ouvertes dans la réponse |
| L3DU-17 | plus tard | `feed.capReached` | plafond sans filtre (EC-L3D-2) : impasse traitée avec les filtres, Lot 6bis |
| L3DU-18 | plus tard | `campaign.json` l. 487-491 | « numéraire », « dotation », « Affiliation » : « en argent », « produit offert », « commission sur ventes », avec `product-owner` |
| L3DU-19 | plus tard | fil | créateur d'un pays non ouvert (principe 9) : posé avec la candidature, Lot 4 |
