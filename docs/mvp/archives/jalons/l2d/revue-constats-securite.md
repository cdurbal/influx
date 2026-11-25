# L2D — constats `expert-cybersecurite` (revue de fin de jalon)

> 2026-11-06 · plage `547cecf^..HEAD` (21 commits, HEAD `7e0acc3`, `fe380b6` d'une autre session compris), diff fichier
> par fichier · aucun fichier modifié hors celui-ci · gravités : bloquant · à corriger dans le jalon · avant production ·
> plus tard. **Aucun bloquant, rien à corriger dans le jalon.**

## Constats

| # | Gravité | Fichier:ligne | Constat (scénario, impact) | Correctif |
|---|---|---|---|---|
| L2DS-1 | avant production (au plus tard avant tout rendu cliquable de `profile_url`, backoffice L2E ou révélation Lot 4) | `packages/domain/src/creator-profile/network-line.ts:57,75` ; `supabase/migrations/0217_profiles_creator_identity.sql:205,269,277` | RG43 contournable : l'autorité est lue par `[^/?#]*`, qui ne s'arrête pas à la barre oblique inverse. `https://evil.example\.instagram.com/x` est accepté par le domaine **et** par la garde de la base (hôte « se termine par `.instagram.com` »), alors qu'un navigateur (WHATWG, vérifié sous Node 24 : hôte `evil.example`, chemin `/.instagram.com/x`) ouvre `evil.example`. Scénario : un créateur dépose un lien d'hameçonnage présenté comme son compte Instagram ; l'agent qui vérifie le compte (L2E) ou la marque après révélation (Lot 4) clique. Impact : vol d'identifiants backoffice ou marque. Aucune exposition au L2D (l'URL n'est rendue que dans un champ de saisie). | Exiger une autorité `^[A-Za-z0-9.-]+(:[0-9]{1,5})?$` (sinon `invalid_shape`, 23514) dans `checkProfileUrl` et dans une migration qui recrée `guard_creator_social_account()`, avec témoins `\` et `%5C` refusés ; 0,25 j. |
| L2DS-2 | plus tard (dans la migration L2E qui ouvre `agent_observed`) | `0217:516-518` ; `0218_profiles_creator_bands_and_history.sql:530, 689-698` | Le créateur garde `UPDATE` des métriques et de `engagement_rate_bp` sans que `figures_source` soit remis à `declared` (seule la porte le fait). Une fois L2E livrée : l'agent observe 50 000 abonnés (`agent_observed`), le créateur tape 500 000 par l'autosave ; la tranche publique dérivée et l'historique portent alors « observé par INFLUX » sur un chiffre déclaré, et la tranche d'engagement (RG48) sortirait d'une saisie membre. Impact : fraude au badge et aux chiffres présentés aux marques. Sans objet au L2D (aucun écrivain `agent_observed`). | Déclencheur `BEFORE UPDATE` : sous `influx_creator`, toute modification d'une métrique ou de l'engagement force `figures_source = 'declared'` (et vide la date si elle venait d'un agent), test « agent puis créateur » ; 0,25 j. |
| L2DS-3 | plus tard (avant l'ouverture de la vitrine, Lot 3) | `apps/api/db-tests/profiles-creator-identity.test.ts:197-221` ; `0217:600-629` (assertions identiques en `0218`, `0219`) | T1-R ne voit que les objets de `profiles` nommés `creator_%` et les fonctions dont le nom contient `creator`. Une vue (droits du propriétaire) ou une fonction `SECURITY DEFINER` d'un autre nom ou d'un autre schéma (`search.*`, une porte de recherche au Lot 3) lisant `creator_identities` et accordée à `influx_advertiser` passerait la garde ; seul le balayage T1 de l'API (marqueurs) la rattraperait. | Ajouter à T1-R : toute relation ou fonction exécutable par `influx_advertiser`, tous schémas, dont `pg_depend`/`pg_rewrite` (vues) ou `prosrc` (fonctions) nomme une table `profiles.creator_%` hors liste d'exceptions du Lot 3 ; 0,25 j. |
| L2DS-4 | plus tard (L2G, avant tout passage hors `draft`) | `0216_profiles_creator_public.sql:318-322` ; `apps/api/src/domains/profiles/creator/profile.ts:49-53` ; `0217:506-508` | La politique d'écriture de la vitrine ne dépend d'aucun état, `WRITABLE_STATUSES` admet `pending_review`, et `headline`, `bio`, `handle`, `pseudonym` (textes [M]) vivent non modérés dans les objets qui sortiront ; `completeness_percent` est écrivable par `influx_creator`. P5 tient au L2D (aucun droit annonceur, aucune sortie) ; à L2G, sans le mécanisme du L2C, un texte modifié après examen sortirait non modéré. | À L2G, reprendre le L2C pour le créateur (jeton de version à la décision, gel des champs modérés une fois publié, garde de statut en base comme L2CS-3) et recalculer la complétude dans la porte de soumission sans lire la colonne ; inclus dans L2G. |
| L2DS-5 | plus tard (à surveiller ; avant le Lot 3) | `0218:271-376` ; `docs/mvp/03-matrice-des-droits-et-rls.md` l. 896 | `influx_identity_definer` cumule désormais les portes exécutables par la marque (`0203`, `0204`, `0209`), le parcours d'inscription et les dérivations créateur : il lit les chiffres et l'audience exacts de **tout** créateur et écrit leurs lignes publiques. Aujourd'hui sans effet (aucun SQL dynamique dans les fonctions du domaine, vérifié ; corps statiques, `search_path` vide) ; une faille future dans une porte marque deviendrait une lecture de la couche I. | Assertion de fin et test : aucune fonction possédée par `influx_identity_definer` ne contient `execute` dynamique ; si une porte marque doit lire au Lot 3, confier les dérivations créateur à un propriétaire distinct ; 0,1 j. |
| L2DS-6 | plus tard (à surveiller) | `0218:509-528, 730-733, 356-362` | Valeurs publiques figées hors du chemin d'écriture : une migration qui change les bornes de `audience_bands`, `publication_frequencies`, `comment_bands` (ou un `retired_at` futur atteint) laisse des tranches dérivées fausses ; un compte créateur passé annonceur (`0134`) ne suit plus le pays de son compte (politique bornée au rôle `creator`). Aucun rôle d'exécution n'écrit ces bornes (vérifié). | Toute migration touchant ces bornes rejoue la reprise de `0218` §8 ; L2G refuse `change_member_role()` hors `draft` (fiche, point 6) ; 0 j maintenant. |
| L2DS-7 | plus tard (Lot 6) | `0218:825-831` ; `apps/api/src/domains/profiles/creator/routes.ts:149-165` | Aucune limite de débit sur les écritures membres : un créateur qui alterne une métrique par script crée une ligne d'historique par requête, sans borne ; l'export (art. 15) grossit d'autant. Impact : coût et lenteur, données du seul auteur. | Limite par compte sur les routes d'écriture membres (Lot 6, avec celles de la marque) ou fusion des entrées non confirmées d'une même ligne sur quelques minutes ; 0,25 j. |

## Points vérifiés (section « Pour `expert-cybersecurite` »)

- **03 à 06** : RLS activée et forcée sur les quinze tables `profiles.creator_%` et `reference.network_url_hosts` ;
  `revoke all` de `public`, `anon`, `authenticated`, `service_role` sur chaque table, fonction et séquence ; **aucun droit
  d'`influx_advertiser`** (table, colonne, séquence, fonction, politique), `revoke` explicite en `0217` §8, `0218` §2.1 ;
  `SECURITY DEFINER` : `provision_account()` (identique à `0109` hors vitrine, diff vérifié), sept dérivations et la porte
  (`0218`), `execute_request()` (`0219`), tous à `search_path = ''`, propriétaire assertionné ; garde, bornes et contrôle de
  somme invoker, sans `EXECUTE`.
- **P5** : `creator_public_*` ne porte que tranches, codes, booléens, dates et textes [M] (L2DS-4) ; `public_ref`
  aléatoire, alias tiré de `gen_random_uuid()` sans entrée, sans biais (rejet ≥ 252) ; `status`, `alias`, `public_ref`,
  tranches dérivées, `availability_declared_at`, `figures_source`, `figures_measured_at` sans droit d'écriture membre ni
  interne (assertions de fin et grants relus).
- **04** : en-tête non réversible et `revoke` explicites ; garde par nom de T1-R contournable hors de son nom (L2DS-3).
- **05** : dérivation incontournable par le membre (aucun droit sur les lignes publiques ni les colonnes dérivées) ; ligne
  principale (décochage puis écriture en deux ordres, unicité), suppression (cascade, rafraîchissement), pays (déclencheur
  sur `identity.accounts`, garde : la résidence seule sur la ligne d'autrui sous `correct_member_account()`), porte liée à
  la session et à un compte créateur actif, 42501 identique pour la ligne d'autrui : aucune tranche fausse par un chemin
  d'écriture actuel (limites : L2DS-2, L2DS-6).
- **06** : effacement dans la même transaction, politiques bornées à un compte `deleted` et à la ligne vidée, aucune
  dérivation déclenchée ; restent vitrine (clés, alias, pays, `suspended`), identité vide, lignes (réseau, principal,
  source) : conforme à `modele.md` §0219. Export : données du seul demandeur, ni `public_ref` ni identifiant de ligne,
  auteur interne en « INFLUX ».
- **08, 09** : schémas `strictObject` en entrée et en sortie, `id` en `z.uuid()` ; IDOR : chaque requête porte
  `account_id = current_account_id()` en plus de la politique, lecture préalable de la ligne, clé étrangère composite
  pour l'audience ; `creator_identities` servi au seul créateur, `no-store` ; autres rôles : 404 ; erreurs de base
  traduites en 400/409 sans valeur, `detail` censuré par le journal ; avertissements de détection : signal et positions,
  ni stockés ni journalisés. `fe380b6`, `ef64573`, écrans : aucun lien externe, `innerHTML`, `NEXT_PUBLIC` ni stockage local.
- **01** (`b2f7981`, I-4 par `ci.yml`) : seul le nombre d'éclats change ; ancre, `continue-on-error` du contrôle des
  marqueurs, permissions et secrets inchangés.

## Relecture de `0215` (L2C-fix2)

**Faite ici**, courte : diff des fonctions recréées contre `0210`/`0211` ; L2CS-1 (profil verrouillé avant l'entrée à
l'ouverture), L2CS-2 (compte détenu refusé en 42501 dans `open`, `extend`, `publish`, `reject`, `read_advertiser_review_logo`,
refus journalisé `queue.conflict_of_interest`), L2CS-3 (garde : un membre ne déplace le statut que vers `pending_review`)
conformes, aucun autre changement. Aucun constat ; la ligne L2C-fix2 de `21` §8 peut être soldée en clôture.

## Signatures `03` P7 (à reporter en clôture, l. 896 et 912)

- `influx_identity_definer`, clause L2D (`0216` à `0218`) : **signé** par `expert-cybersecurite` le 2026-11-06, sous L2DS-5.
- `influx_privacy_definer`, clause L2D (`0219`) : **signé** par `expert-cybersecurite` le 2026-11-06.

## Attestation (commit séparé de clôture, `git commit --allow-empty -F <fichier>`)

```
chore(security): attest the end-of-L2D review

Group review of 2026-11-06 (expert-cybersecurite) over the L2D milestone
(547cecf^..7e0acc3), no blocker; findings L2DS-1 to L2DS-7 in
docs/mvp/archives/jalons/l2d/revue-constats-securite.md. 01: ci.yml only
moves the browser journeys to three shards; the marker check, its anchor,
permissions and secrets are unchanged. 03: 0216 enables and forces RLS on
the storefront and its five lists, revokes all from PUBLIC and the Data API
roles, gives influx_advertiser nothing; the creator writes ten entered
columns, never status, alias, public_ref, a derived band nor a date; the
alias is drawn from gen_random_uuid() without input; provision_account()
is 0109 plus the storefront. 04: 0217 is non reversible, with an explicit
REVOKE of influx_advertiser on the identity, the lines, the exact audience,
the refused sectors and the append-only history. 05: 0218 derivations and
the figures door are SECURITY DEFINER owned by influx_identity_definer,
empty search_path, no EXECUTE but the door to influx_creator, bound to the
session's line; the residence guard holds correct_member_account(). 06:
0219 exports the owner's data only and erases in one transaction, its write
policies bound to a deleted account and to the emptied row. 03 P7 signed
for influx_identity_definer (0216 to 0218) and influx_privacy_definer
(0219). 0215 (L2C-fix2) read again: conforms.

security-reviewed: 2026-11-06
security-reviewed: 2026-11-06 covers b2f798191225b2cd84a88ddccea30fd57b5583a2 1073a8cb90c2d41a1add17116c0c3beebdfe93b9 1abb8f71deb838fa4d50199fa1e0e4402f2d7b86 871d579a2b2677d5b2e5a8fd66dc698228a84e6d 24ae6a15a0c7dfc1197f531575f26ee0be18255d
```

(Ligne d'attribution de la session qui commite, après.) `check-security-review.ts 547cecf^ HEAD` relève exactement ces cinq
commits : `b2f7981` (01, `ci.yml`), `1073a8c` (03, `0216`), `1abb8f7` (04, `0217`), `871d579` (05, `0218`), `24ae6a1` (06,
`0219`). `5b52301` (`0215`) est déjà couvert par l'attestation L2C (`bfe6f75`). Tout correctif ajouté avant la clôture
qui touche une migration ou `ci.yml` porte son propre marqueur.

ETAT : revue sécurité L2D faite ; 0 bloquant, 0 à corriger dans le jalon, 1 avant production (L2DS-1), 6 plus tard
(L2DS-2 à L2DS-7, conditions dites) ; `0215` relue ; attestation prête ; livraison en `production` autorisée sous
condition de L2DS-1 (et de L2DS-2 dès que L2E ouvre l'écriture `agent_observed`).
