# Rotation d'une clé et fuite avérée (lire pour : faire tourner une clé, traiter une fuite)

Rotation : périodiquement, au départ d'un intervenant, et **immédiatement en cas de suspicion de
fuite**. **Deux procédures ; prendre la mauvaise est une faute.** Critère :

> **La clé a-t-elle un effet de bord observable par un tiers ?** Si l'utiliser peut envoyer un
> e-mail, écrire dans un CRM ou contacter une personne réelle, **elle ne se teste jamais avec une clé
> de production posée en `staging`** : c'est une violation de la règle 6 et un **incident** (`16`
> RG115/RG120).

| Service / clé | Effet de bord tiers | Procédure |
|---|---|---|
| `BREVO_API_KEY`, `BREVO_SENDER_*` | **Oui** : e-mail réel | **B** |
| `APOLLO_API_KEY` | **Oui** : écriture CRM, séquence commerciale | **B** |
| `BREVO_WEBHOOK_SECRET_*`, `BREVO_WEBHOOK_PATH_TOKEN_*` | Oui, en flux entrant : une valeur mal basculée **perd des désinscriptions** | **B** |
| `SUPABASE_SECRET_KEY` (une par service) | Non | **A** |
| `DATABASE_URL`, `AUTH_DATABASE_URL`, `WORKER_DATABASE_URL`, `OPS_DATABASE_URL`, `PRIVACY_DATABASE_URL`, `DIRECT_DATABASE_URL` (mots de passe de rôles, distincts par rôle et par environnement) | Non | **A** |
| `INFLUX_API_INTERNAL_SECRET*` (D64) | Non ; `api` et le front concerné doivent basculer ensemble | **A**, en fenêtre creuse |
| `AUTH_TOKEN_SIGNING_SECRET` | Non, mais **perd les parcours de connexion en cours** (15 à 30 min) | **A**, en fenêtre creuse |
| `AUTH_THROTTLE_PEPPER` | Non, mais **remet les compteurs de débit à zéro** | **A** |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (`api` ≠ `worker`) | Non (aucun envoi vers un tiers) | **A/B sortante (sans coupure)** |

## Procédure A : clé sans effet de bord observable

1. Générer la nouvelle valeur côté service.
2. **Renseigner en `staging`, vérifier de bout en bout.**
3. Renseigner en production (sur confirmation du fondateur, `CLAUDE.md` §7 règle 4), redéployer si
   nécessaire.
4. **Révoquer l'ancienne valeur** : l'étape la plus oubliée, la seule qui protège réellement.
5. Vérifier les journaux : usages résiduels.
6. Consigner : date, motif, qui, quelles variables.

## Procédure B : clé à effet de bord réel (Brevo, Apollo, webhooks entrants)

**La vérification se fait en production, jamais avec une clé de production en `staging`. Ce qui rend
l'opération sûre, c'est la fenêtre à deux clés.**

1. **Créer la nouvelle clé sur le compte de production**, sans révoquer l'ancienne (Brevo et Apollo
   acceptent plusieurs clés).
2. **Vérifier que le service accepte les deux valeurs** pendant la bascule :
   - clés sortantes : la nouvelle est renseignée, l'ancienne reste valide côté fournisseur le temps
     que tous les processus aient redémarré ;
   - secrets de webhook entrants : **deux valeurs acceptées simultanément** en comparaison à temps
     constant (`16` RG146-1), sinon chaque retour reçu pendant la bascule est perdu.
3. **Renseigner la nouvelle valeur en production** et redéployer `api` et `worker`.
4. **Vérifier sur un volume minimal** : un envoi transactionnel réel vers une adresse interne, ou un
   unique appel de lecture côté Apollo. **Jamais un envoi de masse comme test de rotation.**
5. **Révoquer l'ancienne clé** et **fermer la fenêtre à deux valeurs** (retirer `_PREVIOUS`). Tant que
   ce n'est pas fait, la rotation n'a rien protégé.
6. Vérifier les journaux du fournisseur : plus aucun appel avec l'ancienne clé.
7. Consigner : date, motif, qui, durée de la fenêtre, date de révocation.

> **En `staging`** (D70) : les clés des **comptes de `staging`** se font tourner par l'agent selon la
> procédure B appliquée à ces comptes (nouvelle clé, Railway et `.env.local`, vérification,
> révocation de l'ancienne). Jamais la clé de production.

## Procédure A/B sortante (sans coupure) : jetons Cloudflare R2

Les jetons R2 n'ont aucun effet d'envoi externe vers un tiers (comme A), mais le changement porte
sur `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` lus au démarrage : pour éviter toute coupure pendant
le redéploiement, Cloudflare R2 permet de garder deux jetons actifs simultanément pendant la bascule
(comme B côté sortant). Chaque service (`api` et `worker`) possède son propre jeton et tourne
indépendamment :

1. **Créer un nouveau jeton R2** dans Cloudflare (`Object Read & Write`, restreint aux **3 seuls
   compartiments de l'environnement**, juridiction **`eu`** en `production`), **sans révoquer
   l'ancien**.
2. **Mettre à jour `R2_ACCESS_KEY_ID` et `R2_SECRET_ACCESS_KEY`** sur le seul service concerné (`api`
   ou `worker`) dans Railway (et, pour `staging` sur `api`, dans `apps/api/.env.local`), puis
   redéployer ce service.
3. **Constater le fonctionnement** sur le service redéployé : lecture/écriture d'une image sur `api`
   ou exécution de `storage_purge` sur `worker`, zéro `AccessDenied` / `SignatureDoesNotMatch` dans
   les journaux.
4. **Révoquer immédiatement l'ancien jeton** dans le tableau de bord Cloudflare R2, puis vérifier les
   journaux (plus aucune erreur d'authentification R2).
5. **Consigner** : date, motif, environnement, service (`api` ou `worker`), qui, date de révocation.

## En cas de fuite avérée

Traiter comme un incident, dans cet ordre :

1. **Révoquer immédiatement** la clé compromise, avant même de comprendre l'origine.
2. Générer et déployer une clé de remplacement (procédure A ou B).
3. Évaluer l'exposition : données accessibles, actions possibles, période. Pour Brevo ou Apollo :
   **« qu'a-t-on pu envoyer, et à qui »**, pas seulement ce qu'on a pu lire.
4. Examiner les journaux du service pour un usage anormal.
5. Purger la donnée de l'historique Git si elle y a été commitée (réécriture d'historique : accord du
   fondateur, elle touche tous les clones).
6. Alerter `expert-cybersecurite` et, si des données personnelles sont concernées,
   `expert-conformite-rgpd` (notification possible à l'autorité de contrôle, délai contraint).
7. Documenter : cause, impact, correctif, prévention.
