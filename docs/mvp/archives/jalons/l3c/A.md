# L3C-A — arbitrage : file 7 et vie d'une campagne (`l3c/modele.md`)
Grille `expert-database`, décision `architecte` (`CLAUDE.md` §7). Skills `supabase-schema`,
`backoffice-ops`. Sans code.
**Lire :** fiche (réponses Q1 à Q3) ; tranches de la ligne A ; `archives/jalons/l3b/modele.md` ;
`archives/jalons/l2g/modele.md` §1, §3 (patron de file) ; `0244` l. 1-70 ; `0303` l. 540-600, 853-863.
**Écrire `l3c/modele.md` (≤ 10 Ko, prime sur `04`, `09` et les prompts pour tout nom), une décision
et son motif par point :**
1. Entrée de file 7 : table, une ouverte par campagne, 2 j renforcée (`sla_policies` : une ligne par
   file), jeton, verrou et levée (D81), alerte RG95, alertes de détection (lecture ou base).
2. Colonnes d'agent de `04` l. 1981-2050 retenues ; instantané (charge = `campaign_creator_view()`,
   version, empreinte), `current_snapshot_id`.
3. Revue renforcée en deux temps : premier avis (motif fermé ou texte, où), masquage, EC-L3C-4,
   `assert_enhanced_review()`.
4. Décisions : refus (RG90, `other`), CA48, marque non publiée ou compte inactif, responsable exigé ;
   propriétaire (`influx_moderation_definer` ou rôle neuf : D81 (5), D78).
5. États : pause, reprise, clôture par la marque (`influx_campaign_definer`), un agent, le système
   (tâche quotidienne) ; « dépublication » (RG93, `09` l. 947) nommée.
6. RG94 : création pour une marque et correction (états et champs admis selon Q1, Q2 ; ancienne et
   nouvelle valeur : table ou registre ; motif).
7. Garde recréée (liste fermée de rôles, L3BS-2) ; porte de soumission recréée (RG15, entrée, RG95).
8. Codes : `campaign.*` de `0303`, `queue.*`, codes neufs et `export_class` (F3) ; e-mails (une clé
   par décision, patron `profile.decision`) ; leads (RG103, attributs RG104, RG105).
9. Réglages (RG6, RG9, RG15, RG88) ; export et effacement (L3BS-5) ; répartition entre `0307` et
   `0310` (EC-L3C-1), index.
**Arrêt si :** un point touche `CLAUDE.md` §2, D78 ou une réponse du fondateur (ligne `fondateur`).
