# L3B-F2 — recette `staging` par le fondateur
Type `fondateur` : arrêt. **Préalable :** lignes 01 à 11 et U (et ses `fix`) `fait` ; dernier push en
CI verte, étape « Migrate staging » (`0303` à `0306`) comprise ; une marque publiée sur `staging`.
**Demander au fondateur**, en français puis en anglais : créer une campagne, remplir deux étapes,
fermer le navigateur, la reprendre (CA72, livrables compris), ouvrir l'aperçu (aucune tranche ni
budget), soumettre une campagne complète → « en cours de validation ».
**Agent, lecture seule sur `staging` (D70) :** `campaigns.campaigns.status = 'pending_review'` et
instant de soumission ; ligne `campaign.submitted` du registre (rang) ; aucun texte ni montant dans
les journaux `ops`. Aucune écriture.
Réponse du fondateur mot pour mot dans `run.md` ; chaque constat ouvre une ligne `fix`.
