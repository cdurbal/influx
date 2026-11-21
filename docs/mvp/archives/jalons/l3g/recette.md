# L3G-F — recette du fondateur sur `staging`
Type `fondateur`. Préparée par l'agent (D70, lecture SQL de `staging`), mesurée par le fondateur.
**Préparer (agent) :** CI verte et « Migrate staging » vert sur le dernier push ; lecture SQL : profils
publiés et cherchables (≥ 30), campagnes publiées de thématiques distinctes (≥ 3), ligne du jour de
`search.supply_counters`, interrupteur faux, demande de recette de L3F ouverte en file 9 (campagne
`a72e3fcd-f461-4a92-a48d-3c3007d78ddc`) ; Q4 (oui) : s'il manque des campagnes, trois campagnes publiées de
marques fictives semées par le rôle de migration (marqueur `seed-fake-profiles`, aucune ligne
`leads.outbox_events`, rien vers Brevo) ; donner au fondateur les liens du backoffice de `staging`.
**Fondateur :** avec un compte agent de `staging`, pour chaque campagne, de la fiche campagne à
« Créateurs compatibles » jusqu'à trois créateurs jugés bons : chronomètre ; puis prendre et clore la
demande de recette en file 9.
**Consigner :** trois durées dans `run.md` § Mesures de clôture ; réponse du fondateur mot pour mot dans
la note ; aucune donnée de recette effacée sans accord.
**Arrêt :** toujours (`ETAT: arret fondateur`). Une durée > 30 s : le lot n'est pas livré (`18` l. 1575),
constat et proposition au fondateur.
