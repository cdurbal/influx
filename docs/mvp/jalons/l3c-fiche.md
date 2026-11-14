# Jalon L3C — Le commercial valide la campagne ; publiée, elle vit ses états
> Source : `jalons/lot3-plan.md` l. 33 (validé le 2026-11-13) · 2026-11-14 · Statut : validé par le fondateur le 2026-11-14 (« oui à toutes les questions » : Q1 à Q3 comme recommandé) · Annexe : `l3c/annexe.md`

## Objectif et périmètre
Une campagne soumise (L3B) entre en file 7 (`campaigns`, `15` l. 298) ; un agent la prend (verrou de
30 min), la publie (instantané versionné, commercial responsable) ou la refuse (motif de RG90) ; en
secteur sensible, deux personnes internes distinctes (RG85, `17b` §3.8). Publiée, la marque la met en
pause, la reprend ou la clôture ; un agent aussi ; le worker la clôture à la fin de période + 30 j
(RG9). Un agent crée un brouillon pour une marque et corrige un champ (RG1, RG94 ; réponse 1 du
fondateur, 2026-11-13). Chaque décision est notifiée par e-mail (RG93) ; la publication part vers
Brevo et Apollo sans texte ni tranche (CA69 à CA71). Migrations `0307` à `0310`.
**Hors périmètre :** RG7 et CA6, CA7 (Q1) ; lecture créateur (L3D : aucun droit créateur sur
`campaigns.*`) ; candidatures, plafond RG78 (Lot 4) ; RG11 à la suspension (porte du Lot 5) ; RG96,
alerte CA63, RG91 (tableau de bord, mode serré `00` §9 point 4) ; duplication ; `campaign_price_bands` (D78).
**Budget e2e : 18 s** (Q3).

## Invariants
1. RG5, CA5 : `published` n'est écrit que par la porte de décision d'un agent ou d'un admin ; aucune
   porte membre ni tâche ; `campaigns_published_needs_review`.
2. RG85, CA56, CA57 : secteur sensible (jointure sur `reference.sectors`, jamais recopié) → deux
   personnes internes distinctes, admin compris ; premier avis motivé, entrée masquée au premier
   examinateur ; un refus n'exige qu'une personne.
3. D78, TM5.6 : l'instantané est la sortie de `campaign_creator_view()` (`l3b/modele.md` §6) ; jamais
   devise, tranche, budget total, référence, notes, déclaration, sensibilité ; `influx_creator` sans
   droit sur `campaigns.*`.
4. D81 : une entrée ouverte au plus par campagne ; `sla_due_at`, `escalate_at` figés à l'entrée (1 j
   ouvré, 2 j en revue renforcée) ; prise atomique ; jeton de version calculé, décision refusée s'il a
   changé ; levée forcée par un admin avec motif ; codes `queue.*` ; compte propre ou détenu : 42501
   et `queue.conflict_of_interest` (`15` RG36).
5. RG89, RG90, RG92 : publier, ou refuser avec un motif de la liste fermée ; `other` exige un message ;
   commentaire interne et premier avis ne partent ni à la marque, ni vers Brevo, ni au registre.
6. RG93, RG94, C(7) : toute décision et toute intervention d'agent sont journalisées nominativement
   (charge typée, aucun texte libre au registre) et notifiées à la marque dans sa langue ; une
   correction garde ancienne et nouvelle valeur et un motif.
7. RG9 : clôture irréversible, aucune donnée effacée ; clôture automatique par le seul acteur
   système ; la date limite de candidature dépassée n'écrit rien (CA49).
8. RG103 à RG107 : `campaign.published` émis dans la transaction, charge réduite à des identifiants,
   consentement relu à la consommation ; rien de RG106 ne part ; Apollo ne reçoit que « a publié une
   campagne » et sa date ; champ absent envoyé vide.
9. RG6, RG9, RG15, RG88 : délais, plafond, expiration en table (`backoffice.sla_policies`,
   `operational_settings`), écriture admin journalisée, aucune constante dans le code.
10. Fonction `SECURITY DEFINER` neuve : propriétaire de la liste de `03` P7, `search_path = ''`,
    `REVOKE … FROM PUBLIC`, `GRANT` nominatif, aucun `execute` dynamique ; garde de gel en liste
    fermée de rôles (L3BS-2) ; signalé I-4 avec tout `GRANT`, politique ou objet `audit.*`.
11. T14 : identifiant inconnu, campagne d'une autre marque, entrée d'un compte détenu : même code,
    même corps.
12. D48, T16 : aucune opération sur un montant ; l'agent lit la tranche par son libellé seul.
13. Écrans : backoffice poste de travail (`17b` §3.8 ; mobile D58 sans geste neuf), D74, FR/EN,
    WCAG AA, six états écrits (CA74), tokens KEO seuls.
14. Aucun plancher baissé ; tout fichier de test neuf déclaré dans `db-tests/shards.ts` et
    `case-floors.ts`, ou `e2e/case-floors.ts`.

## Lectures
Commun : cette fiche ; `09` l. 1-6 (D48, D78) ; `l3c/modele.md` dès A ; `archives/jalons/l3b/modele.md`
(noms en vigueur). Chemins de `docs/mvp/` abrégés ; migrations par leur numéro.
| # | Tranches principales (le prompt complète) |
|---|---|
| 01 | `archives/jalons/l3b/annexe.md` l. 114 ; `brand-campaign.spec.ts` l. 160-172 ; `db-tests/campaign-routes-kit.ts` |
| A | `09` l. 150-242, 683-783, 825-845, 937-958, 1011-1049, 1192-1253, 1274-1286, 1321-1390 ; `04` l. 1981-2050, 6236-6246 ; `03` l. 259-262, 316-341, 818-1010 ; `15` l. 256-370 ; `17b` l. 1243-1293 ; D81 ; `0129` l. 100-135, 262-290 |
| 02 à 05 | `modele.md` ; `0244`, `0245` (patrons) ; `0305`, `0306` ; `0206` (réglages) ; `0230` (tâche périodique) |
| 06 | `profiles/brand-decision-email.ts` ; `leads/connectors/brevo/`, `apollo/` ; `maintenance/periodic.ts` |
| 07 | `backoffice/creator-queues-routes.ts`, `creator-queues-decision-routes.ts` ; `contracts/src/creator-queues.ts` |
| 08, 09 | `17b` l. 1046-1124, 1243-1293 ; `QueueTemplate.tsx`, `ClaimedEntryFrame.tsx`, `CreatorReview*.tsx`, `BoReasonPicker.tsx` |
| 10 | `17` l. 1222-1229 ; `09` l. 855-893 ; `components/campaign/CampaignListScreen.tsx`, `campaign-api.ts` |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `test: derive the campaign test dates from today` | L3BT-9 : dates relatives dans les tests base et e2e des campagnes, aucun attendu changé. |
| A | arbitrage `architecte` (grille `expert-database`) | `l3c/modele.md` : file 7, instantané, revue renforcée, états, clôture, interventions d'agent, réglages, leads, export, numéros. |
| 02 | `feat(db): 0307 campaign review queue, claims and settings` | Entrée créée à la soumission (porte recréée : RG15, alerte RG95), délais et réglages, verrou, garde L3BS-2. |
| 03 | `feat(db): 0308 publish or reject a campaign, enhanced review` | Instantané, deux examens en secteur sensible, refus typé, CA48, `campaign.published`, TM5.1. |
| 04 | `feat(db): 0309 pause, close and agent interventions on a campaign` | Pause, reprise, clôture (marque, agent, système) ; création et correction par un agent (RG94). |
| 05 | `feat(db): 0310 campaign decisions in the data export, the erasure and the lead reads` | Export et effacement étendus (L3BS-5) ; lectures `leads.*` des attributs et des e-mails. |
| 06 | `feat(worker): campaign leads, decision e-mails and automatic closure` | RG104, RG105, CA70, CA71 ; un e-mail par décision ; tâche quotidienne de clôture. |
| 07 | `feat(api): campaign review queue and campaign record routes` | `/v1/bo/campaigns…` : file 7, décisions, fiche, correction, création, pause et clôture d'agent ; T14. |
| 08 | `feat(backoffice): the campaign review queue and its decision` | File 7 sur `QueueTemplate`, fiche de validation `17b` §3.8 en deux temps ; e2e ≤ 8 s. |
| 09 | `feat(backoffice): campaign record, field correction and creation for a brand` | Fiche campagne interne, correction motivée, brouillon pour une marque ; e2e ≤ 5 s. |
| 10 | `feat(campaigns): the brand pauses, resumes and closes its campaign` | Routes membres et écrans : états écrits, motif de refus, pause, reprise, clôture confirmée ; e2e ≤ 5 s. |

Puis U (`expert-ux`), F (recette `staging` du fondateur), R (revue groupée), C (clôture).
