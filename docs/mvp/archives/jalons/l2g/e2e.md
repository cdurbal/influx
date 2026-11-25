# L2G-F0 — décision du fondateur : budget e2e (L2D-E2E)
Type `fondateur` : arrêt jusqu'à la réponse, aucun commit.
**Lire :** fiche § Écarts (premier paragraphe) ; `21` l. 63-67, l. 169 ; `archives/jalons/l2f/run.md` § Mesures de clôture.
**Question :** quatrième jalon sous tension ; levier d'amorce épuisé (gain 1,3 s), le temps restant est le démarrage des serveurs. Choisir :
- **A (recommandé) — budget révisé** : font foi chaque éclat CI ≤ 7 min 30 et le job ≤ 8 min ; la somme des médianes devient indicative ; cible de 20 s par jalon gardée (L2G annonce 19 s). Amende `21` §2.3 point 1 à la clôture.
- **B — quatrième éclat CI** : ligne `commit` ajoutée en tête (`ci(e2e): browser journeys in four shards`, `integrateur`, sonnet high), éclats mesurés avant et après.
- **C — dépassement accepté une fois de plus**, sans changer la règle.
**Écrire :** la réponse mot pour mot dans la note de la ligne F0 de `run.md` ; si B, ajouter la ligne.
**Arrêt si :** aucune réponse.
