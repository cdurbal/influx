# L3B-A — arbitrage : modèle des campagnes du L3B (`l3b/modele.md`)
Grille `expert-database`, décision `architecte` (`CLAUDE.md` §7). Skill `supabase-schema`. Sans code.
**Lire :** fiche ; `09` l. 148-242 (§A), tableaux de champs l. 245-253, 306-318, 364-376, 430-440,
483-515, 601-614, 639-646, 685-701 ; l. 706-715 (RG85), 734-755 (RG90), 786-825 (RG98 à RG102),
894-1008 (cas limites), 1453 (Q16) ; `04` l. 1676-2068 (par tranches), 5398-5416, 5974-5977,
6199-6204 ; `03` l. 316-341, P7 l. 818-1010 ; `0203` l. 1-60 ; `0209` l. 1-80 (gel) ;
`decisions-detail.md` § D81 (`Grep`).
**Écrire `l3b/modele.md` (≤ 10 Ko, prime sur `04` pour tout nom), une décision et son motif par point :**
1. Q16 : rangement de la tranche (colonne à clé composite ou `campaign_price_bands` dès `0303`),
   `campaigns_cash_range_required` reformulée, devise sans tranche (SQLSTATE, DETAIL), dotation
   seule, affiliation ; fourchette exacte gardée, vide (D78).
2. Champ → colonne pour les huit blocs (`09` contre `04` §5.4) ; champ sans colonne (RG44…) nommé, EC.
3. Noms : types, tables filles, référentiels (`campaign_types` 7, `requested_items` 5,
   `rejection_reasons` : RG90 contre `04` l. 1721-1723), codes `campaign.*` et `export_class`.
4. Droits par rôle et état : marque (colonnes, RLS, listes en bloc) ; agent, admin (L3B ou L3C) ;
   créateur : aucun ; gel en `pending_review` (`0209`) ; `rejected` modifiable (RG10).
5. Porte de soumission : propriétaire (D81 (5)), refus (SQLSTATE, DETAIL), RG85 (empreinte du texte
   exact, langue), RG15 (CA10) au L3B ou en L3C.
6. Projection créateur (CA68, RG98) : un seul constructeur, réutilisé tel quel par l'instantané de
   L3C ; SQL ou TS, schéma zod dans `packages/contracts` ; s'il est SQL, il entre dans `0305`.
7. Export et effacement (`09` l. 993 ; `04` §9 muet) : contenu de `0306`.
8. Répartition des objets entre `0303`, `0305` et `0306` ; index (`04` l. 5975).
**Arrêt si :** un point touche `CLAUDE.md` §2 ou D78, ou relève du fondateur (ligne `fondateur`).
