# L3C-F — recette `staging` par le fondateur
Type `fondateur` : arrêt. **Préalable :** lignes 01 à 10 et U (et ses `fix`) `fait` ; dernier push en
CI verte, « Migrate staging » (`0307` à `0310`) compris ; deux comptes internes actifs sur `staging` ;
une campagne `pending_review` (celle de la recette L3B, rang 2373).
**Demander au fondateur**, en français puis en anglais : prendre en charge la campagne en file 7 et
la publier ; côté marque, la mettre en pause, la reprendre, la clôturer ; soumettre une campagne en
catégorie « alcool » : un premier compte interne la transmet, un second la publie ; refuser une
campagne avec un motif et lire l'e-mail reçu par la marque.
**Agent, lecture seule sur `staging` (D70) :** états et instantané v1 ; lignes `campaign.published`,
`campaign.paused`, `campaign.closed`, `campaign.rejected` du registre (rangs) ; ligne
`leads.outbox_events` de la publication (`sent` ou `skipped`), charge sans texte ; aucun texte ni
montant dans les journaux `ops`. Aucune écriture.
Réponse du fondateur mot pour mot dans `run.md` ; chaque constat ouvre une ligne `fix`.
