# Recette `staging` du jalon L2C (fondateur)

Après un déploiement vert de `staging`, avec un compte marque soumis et un compte `agent` (agent ou admin).

1. Compte marque : soumettre le profil, l'état affiché est « en cours de validation ».
2. Backoffice : « Files », « Profils marque à valider ». L'entrée est là, avec son échéance.
3. L'ouvrir : le bandeau dit « Vous avez pris cette entrée en charge ». Le logo s'affiche. Vérifier qu'on peut décider sans autre onglet.
4. Refuser avec un motif, lire le message avant de valider. E-mail reçu dans la langue du compte, sans lien ni montant.
5. Marque : le motif s'affiche, corriger, resoumettre. Backoffice : publier. E-mail reçu.
6. Marque : modifier la présentation. L'ancienne version reste la version publiée, la nouvelle est en attente. Changer la taille d'entreprise : effet immédiat.
7. Backoffice : la révision est en file avec le champ modifié. La publier.
8. Refaire 1 à 5 en anglais, une fois.

**Agent, en lecture seule après la recette :** `audit.audit_events` de la plage, ligne `profile.completed` unique en `done`,
attributs du contact Brevo de `staging`, aucun champ de RG80. Constats notés dans `run.md`, ligne 19 ; un constat bloquant
ajoute une ligne `fix`.
