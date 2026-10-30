# DS-12a — `feat(backoffice): KEO operations screens (lists and record)`

Invoque le skill `design-system-influx`.

**Lire :** `17b@263+100` (§1.7), `18@1624+23` (§12.2) ; composants transverses de `17b` §4 seulement au
besoin (`Grep` d'abord).

**Livrer :** accueil, liste des inscrits (tableau dense de 36 px qui défile dans sa région et reste
atteignable au clavier ; statut écrit en texte, TD6.5), fiche d'inscrit, invitations. Rhabillage seul.

**Prouver :** axe à 1024 et 1440 px avec `wcag22aa` ; TD6.2 sur la liste (375 = poste de travail, 768 =
navigation compacte, aucun défilement horizontal de page).

**Gelés :** `backoffice.spec` J8T-4, `ops-view-model.test`.
