# Files de validation et motifs typés (étapes 1 et 2, règles 1 à 10)

Toute file du backoffice a la même anatomie : ne pas en réinventer une par sujet. Le numéro des
règles est celui de `SKILL.md` et des documents qui le citent (`15` RG28 renvoie à la règle 9).

## Étape 1 — Concevoir une file de validation

### Les files du catalogue

Le catalogue fait foi : **16 files**, avec code, délai de décision, objectif de prise en charge,
verrou, rôle qui traite et action de masse, dans `15` RG29 et RG125 (`Grep "RG29"` dans `15`). À
l'écran elles sont **regroupées en cinq groupes métier** (`17b` §1.3, l. 111-152) ; ne pas
recopier ici la liste des files, elle se périme.

| Groupe | Ce qu'il porte |
|---|---|
| Faire entrer dans le produit | Profils marque et créateur, visuels de portfolio, vérification et badge, identifiants modifiés, campagnes |
| Faire se rencontrer | Demandes de contact et candidatures, sélection par l'équipe INFLUX : le groupe qui porte le chiffre d'affaires |
| Protéger | Signalements, documents, contestations de badge |
| Faire fonctionner la machine | Échecs de synchronisation, échecs d'envoi, adresses injoignables |
| Obligations et contrôles | Demandes de données personnelles, actions en attente de seconde validation |

*(La proposition INFLUX ne passe pas par une file : le commercial est déjà le décideur et
s'attribue l'affaire d'office, `15` RG29 file 8 ; cf. `intermediation-tracking`.)*

### Les sept points à spécifier pour chaque file

1. **Ce qui y entre** : événement déclencheur, données affichées dans la liste, données nécessaires
   à la décision **sans avoir à ouvrir autre chose**. Un agent qui doit ouvrir trois onglets pour
   décider perd la moitié de sa journée.
2. **Tri et priorisation** : critère par défaut explicite (ancienneté, SLA restant, valeur
   estimée), critères de tri disponibles, filtres. Le tri par défaut est une décision produit, pas
   un détail d'implémentation.
3. **Prise en charge avec verrou anti-double-traitement.** **Règle non négociable : deux
   commerciaux ne traitent jamais la même demande.** Prendre une entrée en charge pose un verrou
   nominatif, visible des autres agents (« En cours — Marie »). Le verrou a une **durée
   d'expiration** (30 min au catalogue, `15` RG29) et se libère seul ; il se relâche aussi
   explicitement. Exceptions écrites, là où la concurrence est inoffensive : files de rejeu
   idempotent (`lead_sync_failures`, `email_send_failures`, `15` RG30) et seconde validation.
4. **Attribution** : qui devient responsable, et de quoi. Voir étape 5
   (`references/masse-2v-attribution.md`).
5. **SLA** : délai maximal de traitement, horaires couverts, **comportement au dépassement**.
   Tranché : D39 (1 jour ouvré pour une demande de contact ou une candidature, délai par file
   dans `15` RG29) et D49 (l'entrée reste en file jusqu'à décision, marquée hors délai ;
   l'initiateur est prévenu, un administrateur est alerté à J+1). Ne pas coder un délai en dur :
   il est en base, par file.
6. **Sortie avec motif typé** : favorable ou défavorable, toujours motivée (étape 2).
7. **Réattribution** : qui peut réattribuer, avec quelle trace, et ce que devient le verrou.

**Règles complémentaires :**

8. Une entrée ne disparaît jamais d'une file sans décision : **pas de sortie silencieuse**.
9. Le **délai d'attente de chaque file est un indicateur de premier rang**, affiché en permanence,
   pas un rapport mensuel. Rien ne circule entre deux membres sans validation : une file qui
   s'allonge est une conversion qui s'effondre.

---

## Étape 2 — Imposer des motifs typés

10. **Règle non négociable : toute décision porte un motif choisi dans une liste fermée.** Le texte
    libre est autorisé **en complément**, jamais seul.

Pourquoi c'est structurant, et pas de la bureaucratie : un motif rédigé librement n'est **ni
mesurable, ni comparable, ni exploitable**. Au bout de six mois, personne ne sait pourquoi on
refuse — ni combien de refus viennent d'un profil incomplet, ni combien viennent d'un budget
irréaliste. Or c'est exactement cette information qui dit quoi corriger dans le produit.

Comment construire une liste de motifs correcte :

- **Fermée et courte** : cinq à dix entrées. Au-delà, plus personne ne lit.
- **Exhaustive sur les cas réels** : construite à partir des décisions réellement prises, pas
  imaginée.
- **Exprimée en langage métier**, lisible par le fondateur.
- **Distincte par file** : les motifs de refus d'une campagne n'ont rien à voir avec ceux d'une
  demande de contact.
- Un motif **« autre » exceptionnel et surveillé** : sa fréquence est un indicateur. S'il dépasse
  un seuil, la liste est incomplète et doit être étendue.
- **Chaque motif défavorable porte le message envoyé à l'utilisateur** — pas de refus muet.
