# L3D-A — arbitrage : lecture créateur des campagnes publiées (`l3d/modele.md`)
Grille `expert-database`, décision `architecte`. Skills `supabase-schema`, `matching-spec`. Sans code.
**Lire :** fiche (réponses Q1 à Q3) ; tranches de la ligne A ; `archives/jalons/l3b/modele.md` §6 ;
`archives/jalons/l3c/modele.md` §2, §5, §7 ; `0305` l. 665 et suivantes ; `0308` ;
`profiles/brand-public-view.ts`, `profiles/repository.ts` l. 244-270 ; `platform/public-rate.ts`.
**Écrire `l3d/modele.md` (≤ 10 Ko, prime sur `04`, `09`, `11` et les prompts pour tout nom), une
décision et son motif par point :**
1. Porte : propriétaire (D81 (5), jamais `influx_campaign_review_definer`), fonctions (fil, fiche,
   logo), droits ; `influx_creator` sans droit sur `campaigns.*` ni `profiles.advertiser_*` ; ligne
   publique d'une autre marque au format de `brandPublicViewOf()`.
2. Visibilité (invariant 3) : colonnes lues (instantané ou vivante, secteur compris), jour UTC,
   délai de RG26, RG23, réponse Q1 ; condition 5 de RG14 au Lot 4.
3. Carte : champs de RG15 au pilote, date de publication (`first_published_at` ou instantané),
   « candidatures closes » ; fiche : instantané, marque, `campaign.budget.negotiate`.
4. Tri RG33, départage ; pagination (curseur ou rang, EC-L2C-18c-1), taille, plafond ; RG35.
5. Débit par compte et par adresse (T15.4, T15.5) : compteur (mémoire, `minute-counter.ts`, ou
   base), valeurs en table (hypothèse `staging`), refus journalisé (CA18).
6. Journal RG22 et refus RG100 : table ou registre, codes, `export_class` (F3), export, effacement,
   conservation (`11` Q12 : hypothèse, veto au Lot 6).
7. Routes et contrat (`packages/contracts`) ; logo (campagne visible seule) ; page `/campagnes`
   partagée par rôle (`17` §2.6 ; patron `PROFILE_ACCOUNT_PAGE`).
8. Index du fil ; `0314` (EC-L3D-1) ; amendements `03` (§3.3, P7), `04`
   (§5.4, §5.5, §11) portés par la ligne 02.
**Arrêt si :** un point touche `CLAUDE.md` §2, D46, D78 ou une réponse du fondateur.
