# L3B-B — arbitrage : grille `reference.price_bands` (`l3b/tranches.md`)
Grille `expert-paiement-facturation`. Aucun code. Méthode tranchée le 2026-11-13
(`jalons/lot3-plan.md` l. 17 et question 2) : grille proposée ici, validée par le fondateur en F1.
**Lire :** fiche, invariants 1, 2, 6 ; `09` l. 1-6, 334-341 (RG29, RG30), 478-504 (bandeau D78),
556-577 (RG62 à RG64) ; `04` l. 493-560 ; `supabase/migrations/0201_reference_taxonomies.sql`
l. 299-360 ; `0003_reference_core.sql` l. 51-70 ; `18` l. 759-795 (T16) ; `decisions-detail.md`
§ D48, § D78, § D27 (`Grep "^## D78 "`, jamais en entier).
**Écrire `l3b/tranches.md` (≤ 6 Ko) :**
- Devises proposées à la saisie au pilote et leur motif (international, aucune conversion, RG58) ;
  toute autre devise est refusée à la soumission (Q16).
- Par devise : codes (`price_bands_code_format`), bornes en unité mineure, sémantique des bornes
  (inclusive ou non) écrite, tranches contiguës sans trou ni chevauchement, dernière ouverte
  (`max_amount_minor` nul) ; nets nuls (D48).
- Une seule grille pour le budget par créateur et la valeur de dotation (RG30), ou deux usages
  distincts, et comment, sans colonne neuve si possible.
- Libellés : clés `price_band.<code>` (`price_bands_label_key`) et forme affichée FR/EN (montants
  formatés par la seule conversion exemptée, T16.6, ou textes traduits).
- Tableau prêt à recopier dans `0304` ; 15 lignes de résumé pour le fondateur, recommandation en tête.
**Ne pas toucher :** `CLAUDE.md` §2, taux, `billing.*`.
**Arrêt si :** la grille suppose un taux, un net ou une conversion ; une devise appelle une décision
du fondateur au-delà de la grille (la poser en F1).
