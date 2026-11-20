# L3G-A — arbitrage `architecte` : `l3g/modele.md`
Grilles `expert-database`, `expert-matching`, `product-owner`. Skills : `matching-spec`, `backoffice-ops`
(tranches utiles seules). D38 tranchée (annexe, Q2) ; sélection multiple au Lot 4 (Q3).
**Lire :** fiche ; Lectures, ligne A ; `archives/jalons/l3f/modele.md` (gabarit).
**Livrer :** `docs/mvp/jalons/l3g/modele.md`, 10 Ko au plus, *M.* = motif, `-n` = `EC-L3G-A-n` ; prime sur
`03`, `04`, `10`, `15`, `17b` pour tout nom :
1. Porte identifiée (04) : propriétaire neuf, signature, `EXECUTE`, contrôles dans l'ordre, page (20) et
   plafond, champs servis (pseudo, `@`, lien, nom, ville, chiffres exacts ; ni e-mail ni téléphone, D46),
   états G2, blocage de la paire (marque de la campagne ; sans campagne), E6 et G10, raisons et valeurs
   exactes (RG77).
2. Facettes G livrées : G1, G2, G9, G10 ; G3, G8 si la donnée existe, sinon reportées ; G4 à G7 : Lot 4.
3. Journal (RG78, CA58) : `search_queries` (`view_mode`, `actor_role`), impressions, consultation d'une
   fiche ; export, effacement ; hors AL21 (Lot 5).
4. Pré-remplissage (05) : brief → facettes du socle, campagne admise, journal proposé, retenu, retiré.
5. File 9 (06) : prise, relâche, prolongation, clôture, motifs (sous-ensemble de `13` RG83, I13), ce que
   voit la marque, AL23.
6. Compteurs et alertes (07) : dimensions, heure, idempotence, échec, code neuf de CA60, AL22 (fenêtre,
   seuil), destinataires.
7. Réglages (08) : double validation dans les deux écrivains, type d'opération, ce que l'écran propose,
   kits de test qui ouvrent l'interrupteur.
8. Routes (09, 10), contrats, écrans (12, 13), entrées du rail (`17b` §1.2), e2e.
9. Numéros `0328` à `0332`, amendements par ligne, à relire par qui.
**Ne pas toucher :** code ; `decisions.md`.
**Prouver :** chaque point tranché avec sa source ; `wc -c` ≤ 10 240.
**Arrêt si :** un point exige une décision du fondateur (ligne `fondateur` ajoutée à `run.md`) ou change un
invariant de la fiche.
