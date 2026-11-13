# L3A-A — arbitrage F3 : codes d'audit servis par l'export « mes données »
Grille `expert-cybersecurite`, avec `expert-database` pour le stockage. Aucun code.
**Origine :** `git show 7d7fd240:docs/mvp/jalons/j8-fiche.md` l. 44 (revue du commit 8 de J8 :
« liste d'autorisation des codes du journal exporté », reportée au Lot 3).
**Lire :** fiche, invariant 9 ; `0245` l. 729-739 (`activity_log` : tout code dont le compte est
acteur ou sujet) ; `0006` l. 53-79 (`audit.event_types`) ; `0137` l. 2836-2845 ;
`docs/mvp/04-modele-de-donnees-mvp.md` l. 573-600 ; `docs/mvp/runbooks/demandes-rgpd.md` l. 75-95 ;
`16` l. 1137 ; liste des codes : `Grep "insert into audit.event_types" supabase/migrations` puis
lectures bornées.
**Trancher et écrire** dans `docs/mvp/jalons/l3a/f3.md` (4 Ko au plus) :
- La règle : exporté par défaut (art. 15) ; exclu seulement ce qui révèle une mesure de sécurité
  interne (détection, signal de fraude, garde déclenchée) ou la donnée d'un tiers ; motif par
  famille.
- Le stockage : colonne de `audit.event_types` sans valeur par défaut (proposition) ou autre forme,
  et ce que doit faire une migration qui ajoute un code.
- La table des codes exclus, avec motif ; les autres sont exportés.
- Les amendements : `04` l. 573-600 et `runbooks/demandes-rgpd.md` l. 84, faits dans cette ligne.
**Ne pas toucher :** migrations, code.
**Prouver :** nombre de codes classés égal au nombre de codes en base (`select count(*) from audit.event_types`
sur la pile locale).
**Arrêt si :** une exclusion prive la personne d'une donnée due sans motif de sécurité ; la règle
contredit `16` ou le runbook sans amendement possible : ligne `fondateur`.
