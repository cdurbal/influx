# Registre d'incidents et d'interventions manuelles

Les runbooks (`staging.md` §11 et §12, `production.md` : amorçage, section 10, invitations révoquées) renvoient
à ce registre pour toute intervention que **la base n'audite pas** (le rôle de migration n'exécute pas
`audit.append`). Une ligne par intervention, la plus récente en haut. Aucune adresse e-mail, aucun mot de passe, aucun
lien d'activation, aucune valeur de `.env.local` : l'identifiant du compte suffit, jamais son contenu.

Colonnes : date (UTC) · environnement · intervention (runbook) · compte visé · motif · autorisée par ·
exécutée par · trace d'audit · suites.

| Date | Env. | Intervention | Compte visé | Motif | Autorisée par | Exécutée par | Trace d'audit | Suites |
|---|---|---|---|---|---|---|---|---|
| 2026-11-24 15:34 | `staging` | variables Railway du service `api` : `INFLUX_PUBLIC_BACKOFFICE_URL` et `INFLUX_PUBLIC_SITE_URL` désignaient les domaines de `production` ; remplacées par ceux de `staging` (valeurs déjà justes sur `worker`, `staging.md` §valeurs de référence) | aucun | les liens d'invitation de `staging` (équipe et membres) ouvraient le backoffice et le site de `production` : activation toujours refusée, aucun appel reçu par l'API de `staging` | D70 (`staging` exploité par les agents), sur signalement du fondateur | Claude Code | journal Railway du service `api` (redéploiement) | invitations internes créées avant le correctif : ouvrir leur lien en remplaçant l'hôte par celui de `staging` (le jeton est dans le fragment), ou révoquer (`replaced_by_new_invitation`) et recréer ; origine de l'écart non établie |
| 2026-11-21 19:55 | `staging` | `staging:reset-internal-account` sans `--password-only` (`staging.md` §12) : nouveau mot de passe, TOTP supprimés chez GoTrue, facteur désépinglé, codes de secours et sessions backoffice révoqués, nouveau lien d'activation de 72 h (expire le 2026-11-24 19:55 UTC) | l'unique compte interne « agent » actif de `staging` (ni admin, ni bris de glace, TOTP non épinglé) ; l'admin n'a pas été touché | recette L3G, ligne F : l'agent n'avait aucun TOTP enrôlé, le fondateur devait chronométrer avec un compte agent | le fondateur (« OUI pour les 2 points à régler », 2026-11-21) | un sous-agent Claude Code, sur demande de l'orchestrateur | aucune ligne d'audit applicatif : **cette entrée en tient lieu** | secrets dans `.operator-secrets/staging-internal-account-reset-2026-11-21T19-55-26-557Z.txt` (hors dépôt, ignoré par git) : à effacer après usage, à confirmer par le fondateur ; l'adresse de l'agent est apparue une fois dans la sortie du terminal (`pnpm` répète la commande), jamais dans un fichier ni un commit |
