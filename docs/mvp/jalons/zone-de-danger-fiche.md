# Fiche — Suppression du compte en libre-service, « Zone de danger » et rouge opaque (hors jalon)

> **Demandes du fondateur, 2026-10-27** (verbatim) :
> 1. « retirer la double vérification lorsqu'un utilisateur veut supprimer son compte. La suppression
>    du compte doit être affichée comme ici (Railway) en danger zone. Lorsque tu utilises le rouge
>    comme pour les boutons ou les messages (charte graphique à modifier) base-toi sur ce qui est fait
>    ici chez Railway. Le rouge en transparence ne convient pas. »
> 2. Précision : « je ne veux pas qu'un admin ait besoin de valider la suppression du compte. Par
>    contre oui il faut garder la double validation par le client qui veut supprimer son compte. Le
>    client supprime son compte sans validation par un admin. »
>
> **Pour :** `dev-react-node`, avec `expert-database` (migration), `architecte` (contrat, e-mail) et
> `expert-integrations-api` (Apollo). **Populations :** membres (annonceurs et créateurs) ; agents
> INFLUX (fiche du compte au backoffice, charte du rouge). **Hors jalon** : 1 ligne par commit dans
> `21` (rubrique « Hors jalon » après §J9) ; revue groupée `expert-cybersecurite` + `testeur` à la fin
> du premier jalon du Lot 2 ; `expert-conformite-rgpd` au Lot 6 seulement ; vetos sur `production`
> seulement (D71). Fiche supprimée à la clôture.
>
> **Décision à inscrire : D72** (`docs/mvp/decisions.md`, fondateur, 2026-10-27) — *la suppression
> d'un compte demandée depuis l'espace membre s'exécute sans approbation d'un `admin`, après la double
> validation du membre (mot à taper + code frais `account_deletion`)*. Elle modifie EC-14 et la
> décision 6 du J7 pour ce seul cas ; l'export (`access`) reste approuvé par un `admin`.

## 1. Ce qui existe (constaté le 2026-10-27)

| Étape | Où | Aujourd'hui |
|---|---|---|
| Double validation membre | `apps/web/src/components/account/DataScreen.tsx` (`ConfirmDeletion`, `FreshCode`) | Écran des deux listes + mot `SUPPRIMER`/`DELETE`, puis code frais (`05` RG57, `03` A-10) — **conservé tel quel** |
| Dépôt | `POST /v1/me/data-requests` (`apps/api/src/domains/identity/account-routes.ts` l. 664) | Crée `backoffice.data_subject_requests` (`received`), accusé `privacy.request_received` (`16` RG160) |
| **Approbation `admin`** | Fiche du compte, `AccountScreen.tsx` l. 497 ; `backoffice.approve_data_request_execution()` (`0137` l. 2294), 2V + R | Insère `privacy.request_executions` (`dual_control_request_id`, `approved_by_account_id` **NOT NULL**, CHECK `approver_not_subject`), passe la demande `in_progress` — **à retirer pour l'effacement en libre-service** |
| Exécution | Worker, `apps/api/src/domains/privacy/execution.ts`, pool `PRIVACY_DATABASE_URL` (E-5, `influx_privacy`), une passe par minute | Anonymisation `04` §9.2 + `0137` (EC-J8-37 à 46), sessions supprimées, `account.deleted` P0 vers Brevo et Apollo, utilisateur GoTrue supprimé, clôture `satisfaite` après confirmation (`15` RG79) |
| Apollo | `connectors/apollo/index.ts` l. 99 | `account.deleted` ⇒ `skip erasure_not_propagated` ; si Apollo avait reçu le contact, la demande **reste ouverte** (EC-J8-43) |

**Aucun délai de grâce** n'est prévu par les specs : `04` §9.2 décrit une suppression immédiate
(« la session est révoquée et l'accès fermé immédiatement »). Rétentions inchangées : `04` §9.1 (preuves
CGU et consentement 5 ans, journal transactionnel 13 mois, registre sans purge, affaires 10 ans,
messages 3 ans après clôture).

## 2. Ce que fait le serveur (cible)

### 2.1 Au dépôt, dans **une** transaction de l'API (rôle membre, fonction `SECURITY DEFINER`)

Nouvelle fonction `identity.submit_member_erasure()` (propriétaire `influx_identity_definer`, comme
l'approbation et la consommation du code, EC-J8-36 ; **aucun rôle `BYPASSRLS`**), appelée par la route
existante pour `type = erasure` :

1. Consomme le code frais `account_deletion` (inchangé, RG57).
2. Crée la demande `erasure`, canal `self_service`, **statut `in_progress`** (`due_at` inchangé, RG73).
3. Insère `privacy.request_executions` avec `authorised_by = 'member_fresh_code'`, sans 2V ni approbateur.
4. **Révoque toutes les sessions du compte** (`revoked_by_holder`) ; la réponse efface le cookie comme
   « Fermer toutes les sessions ». Le membre est déconnecté de tous ses appareils.
5. Registre : `privacy.request_received` et nouveau code **`privacy.execution_authorised_by_member`**
   (famille `privacy`, sujet `data_subject_request`, sévérité `critical`), sans adresse.
6. **N'émet plus** l'accusé `privacy.request_received` pour `erasure` (ses textes disent « rien n'est
   supprimé automatiquement » et l'adresse sera remplacée avant l'envoi) ; il reste pour `access`.

Une demande `erasure` déjà ouverte ⇒ renvoyée telle quelle (idempotence actuelle). Réponse : nouveau
résultat `erasure_authorised` dans `packages/contracts` (`account`).

> **Validé par `architecte` (2026-10-27), avec précisions.** (a) `SECURITY DEFINER`, `SET search_path
> = ''`, noms qualifiés ; `REVOKE EXECUTE … FROM PUBLIC`, `GRANT EXECUTE` aux seuls rôles membres ; le
> compte vient du contexte de session (`SET LOCAL`), **jamais d'un paramètre** ; `influx_identity_definer`
> reçoit `INSERT` sur `privacy.request_executions` seulement (ni `UPDATE` ni `DELETE`) ; tout échec
> (code, session) annule l'ensemble. (b) `erasure_authorised` rejoint l'union discriminée de la réponse
> de la route (schéma zod de réponse obligatoire) ; il ne porte que `requestId` et `status`, et le front
> traite ce résultat comme une déconnexion (cookie effacé, retour à l'accueil).

### 2.2 Au tour suivant du worker (≤ 1 min), E-5 inchangé dans son principe

`privacy.pending_work()` retient aussi les exécutions `member_fresh_code`. `privacy.execute_request()`
fait ce qu'il fait déjà (anonymisation, sessions supprimées, `account.deleted` P0, `account.anonymized`),
**plus** :

- ferme une demande `access` ouverte du compte, issue `retiree_par_le_demandeur`, et efface tout
  `privacy.data_exports` du compte (le membre ne pourra plus se connecter pour le télécharger) ;
- met en file l'e-mail **`privacy.erasure_completed`** (P1, §2.3) vers l'adresse conservée
  `propagation_email` ;
- au Lot 2 et après : voir §4 (badge, profils, Storage, mises en relation, affaires, conversations).

Puis `delete_auth_user` et `complete` comme aujourd'hui. Clôture `satisfaite` quand : Brevo a confirmé
la suppression du contact, Apollo a confirmé ou n'a jamais reçu le contact, GoTrue ne connaît plus
l'utilisateur, **et** l'e-mail de confirmation a son `messageId` (`notification_message_id`, à ouvrir
à `erasure`). `propagation_email` passe à `NULL` à la clôture (EC-J8-46, inchangé).

**Un échec de propagation n'empêche jamais la suppression** : l'anonymisation est faite et le compte
fermé dès `execute`. Brevo ou Apollo en échec ⇒ ligne `outbox_events` `failed`, **rejouable depuis
l'écran de synchronisation du backoffice** (J8) ; la demande reste ouverte jusqu'à confirmation (RG79).

### 2.3 E-mail `privacy.erasure_completed` (FR/EN, rendu par INFLUX comme RG160)

Langue et fuseau du compte capturés à l'exécution. **Aucun lien**, aucune donnée autre que la date
(mêmes interdits que RG160). Corps : titre « Votre compte INFLUX est supprimé » / « Your INFLUX account
has been deleted » ; date et heure de la suppression ; **ce qui a été supprimé** ; **ce qui est
conservé, sous une forme qui ne vous nomme plus, et pourquoi** (RG80 : registre, preuves d'acceptation
des CGU et du consentement, e-mails déjà envoyés, journal transactionnel ; puis mises en relation,
affaires, conversations dès qu'elles existent) ; « une nouvelle inscription crée un compte entièrement
nouveau » (RG70) ; « pas vous ? » ⇒ signaler depuis l'aide de l'écran de connexion. Cet e-mail est la
**réponse** au sens de l'art. 12(3) (il remplace la réponse rédigée par l'agent). Textes exacts à
écrire dans `16` §H ter (nouvelle RG après RG160), relecture juriste avec RG160.

### 2.4 Modèle de données (migration `0150`, auteur `expert-database`, relue par `architecte`)

`privacy.request_executions` :

- `authorised_by text not null` ∈ {`admin_dual_control`, `member_fresh_code`} (existant ⇒ `admin_dual_control`) ;
- `dual_control_request_id`, `approved_by_account_id` deviennent **nullables**, avec CHECK :
  `admin_dual_control` ⇒ les deux renseignés et `approved_by_account_id <> account_id` (RG36 conservé) ;
  `member_fresh_code` ⇒ les deux `NULL`, `request_type = 'erasure'` et demande de canal `self_service` ;
- `request_executions_access_columns` élargi : `notification_message_id` permis pour `erasure` ;
  `request_executions_erasure_completion` exige aussi `notification_message_id` ;
- `GRANT INSERT` membre : **aucun** ; seule `identity.submit_member_erasure()` écrit ;
- fonctions recréées par leur propriétaire : `privacy.pending_work()`, `privacy.execute_request()`,
  `privacy.complete_request()` ; lecture de l'adresse pour l'e-mail par une fonction
  `influx_privacy_definer` sur le modèle de `leads.read_brevo_erasure_subject()` — **validé
  `architecte`** : `privacy.read_erasure_notification_subject(request_id)`, `SECURITY DEFINER`,
  `search_path` vide, `EXECUTE` au seul `influx_privacy` (worker) ; rend adresse, langue et fuseau
  uniquement si l'exécution existe, n'est pas close et `propagation_email` n'est pas `NULL` ; aucun
  `SELECT` direct sur la colonne ;
- `audit.event_types` : `privacy.execution_authorised_by_member` ; matrice `expected-rights.ts` à jour (T2).

### 2.5 Backoffice

- Fiche du compte (`AccountScreen.tsx` `DataRequests`) : une suppression en libre-service s'affiche **en
  lecture seule** — « Suppression demandée et confirmée par le membre (code frais) le ⟨date⟩ · exécutée
  le ⟨date⟩ · Brevo ⟨état⟩ · Apollo ⟨état⟩ · close le ⟨date⟩ ». **Aucun bouton d'approbation.**
- `privacy.approve_data_request` reste pour `access`, et pour un effacement reçu par un autre canal
  (e-mail, oral : Lot 5, `0502`).
- Compte supprimé : fiche en lecture seule existante (`17b` l. 1064).
- Nouvelle alerte (numéro à attribuer dans `15`) : exécution autorisée par un membre et non exécutée
  après 15 min, ou demande non close après 24 h (Brevo, Apollo ou e-mail en échec).

## 3. Écran — « Zone de danger » (double validation conservée)

Parcours : Mes données ⇒ **Zone de danger** ⇒ [Supprimer mon compte] ⇒ **écran de confirmation
(deux listes + mot à taper)** ⇒ **code frais** ⇒ **écran final « Votre compte est supprimé »**.

Dernière section de `DataScreen`, après « Exporter mes données » (pas de nouvelle route, DZ-5) :

```
┌─ ▲ Zone de danger ─────────────────────────────────────────────── h2 (icône aria-hidden + mot)
│ Supprimer mon compte                                              h3 blanc gras
│ ┌──────────────────────────────────────────────────────────────┐
│ │ ▲  **La suppression de votre compte est immédiate et          │  fond = fond du conteneur
│ │    définitive. Elle ne peut pas être annulée.** Vous serez    │  bordure 1 px rouge pleine
│ │    déconnecté de tous vos appareils.                          │  texte rouge opaque, --radius-sm
│ └──────────────────────────────────────────────────────────────┘
│ (si un export est disponible ou en cours) Téléchargez d'abord votre export : il sera effacé avec votre compte.
│ [ Supprimer mon compte ]   ← bouton rouge PLEIN, forme pilule INFLUX
└──────────────────────────────────────────────────────────────────
```

- `ConfirmDeletion` **conservé** (deux listes de même poids, mot à taper, `17` §6.3) : son encadré
  `manual` (« Rien n'est supprimé automatiquement… ») est remplacé par le même encadré danger ; son
  bouton « Supprimer définitivement » devient rouge plein ; « Annuler » reste secondaire.
- Après le code : écran final sans navigation de compte (session close) — h1 « Votre compte est
  supprimé » / « Your account has been deleted », « Un e-mail de confirmation part à votre adresse. »,
  lien vers l'accueil. Statut annoncé (`role="status"`).
- Encadré : `<div>` statique, icône `TriangleAlertIcon` + texte, **jamais la couleur seule** (P7) ; gras
  via `t.rich`. Hors ligne ⇒ bouton `aria-disabled`, gris.

**Libellés** (`apps/web/src/locales/{fr,en}/account.json`) :

| Clé | FR | EN |
|---|---|---|
| `data.lead` | Demandez une copie de vos données, ou supprimez votre compte. | Request a copy of your data, or delete your account. |
| `data.danger.title` | Zone de danger | Danger zone |
| `data.danger.deleteTitle` | Supprimer mon compte | Delete my account |
| `data.danger.warning` | `<strong>`La suppression de votre compte est immédiate et définitive. Elle ne peut pas être annulée.`</strong>` Vous serez déconnecté de tous vos appareils. | `<strong>`Deleting your account is immediate and permanent. It can't be undone.`</strong>` You will be signed out on all your devices. |
| `data.danger.exportFirst` | Téléchargez d'abord votre export : il sera effacé avec votre compte. | Download your export first: it will be erased with your account. |
| `data.deleted.title` | Votre compte est supprimé | Your account has been deleted |
| `data.deleted.text` | Un e-mail de confirmation part à votre adresse. Une nouvelle inscription avec la même adresse créera un compte entièrement nouveau. | A confirmation email is on its way to your address. Signing up again with the same address will create an entirely new account. |
| `data.deleted.home` | Retour à l'accueil | Back to home |

Retirées : `confirm.manual`, `delete.text`, `done.erasure`. `confirm.word`, `wordLabel`, `wordError`,
`submit`, `next`, les listes : **conservées**.

## 4. Cas limites

| Cas | Règle |
|---|---|
| Suppression pendant qu'un export est ouvert ou disponible | Avertissement `exportFirst` ; à l'exécution, demande `access` close `retiree_par_le_demandeur`, export effacé |
| Compte suspendu ou non `active` | Pas de session possible ⇒ pas de dépôt ; une exécution sur un compte devenu non actif reste hors `pending_work` (EC-J8-45) et déclenche l'alerte §2.5 |
| Reconnexion entre le dépôt et l'exécution (≤ 1 min) | Possible avec un nouveau code ; la session est supprimée à l'exécution (EC-J8-37) |
| Réinscription avec la même adresse après exécution | Compte entièrement nouveau (`05` RG70, CA31) |
| Badge vérifié (Lot 2) | Retrait immédiat `account_closed` par `execute_request` (`08` l. 873), sans humain |
| Profils, portfolio, pièces (Lot 2) | Vidés et retirés du Storage par `execute_request` (`04` §9.2 point 2) |
| Mise en relation en file de validation (Lot 4) | Close automatiquement, motif « compte supprimé » ; l'autre partie est informée sans détail |
| Conversation à trois ouverte (Lot 4) | Messages conservés, auteur « Compte supprimé » pour l'autre partie et les agents ; message système `party.account_deleted` visible des trois ; le commercial est alerté (`12` RG14, RG109) ; apartés pseudonymisés (`12` l. 1422) |
| Affaire en cours dans le pipeline (Lot 4-5) | Conservée avec montants, devise, dates, commercial et lien `MER-…` (`14` cas 22, `04` §9.2) : **la commission reste traçable** ; notification système au commercial responsable (remplace `15` RG75 étape 4) ; suppression **non bloquante** (DZ-2) |
| Compte marque à plusieurs membres | Sans objet : un compte par marque au MVP (`00` l. 252, `06` l. 985) |
| Agent ou `admin` INFLUX | Hors périmètre : pas d'espace « Mes données » au backoffice |

**Règle nouvelle (sans humain dans la boucle)** : toute migration qui crée une table portant une donnée
personnelle d'un membre **étend `privacy.execute_request()` dans le même commit**, avec son test
`test:db`. À reprendre dans la fiche du premier jalon du Lot 2 (profils, badge, Storage) : sans cela,
une suppression automatique laisserait ces données en place.

## 5. Charte graphique — le rouge « danger » (Railway), opaque

**Règle** : aucun rouge translucide ni teinté en fond (`rgba`, `hsla`, `#rrggbbaa`, `color-mix`,
modificateur `/NN`, fond rouge sombre type `#2b1212`). Message ou encadré d'erreur = **fond du
conteneur + bordure rouge pleine 1 px + icône + texte rouge opaque** ; action destructive = **bouton
rouge plein, texte clair**.

À l'identique dans `apps/web/src/styles/tokens.css` **et** `apps/backoffice/src/styles/tokens.css` :

| Token | Avant | Après | Rôle |
|---|---|---|---|
| `--color-feedback-error-text` | `#f87171` | `#ec5d5e` | Texte d'erreur et d'alerte danger |
| `--color-feedback-error-icon` | `#f87171` | `#ec5d5e` | Icône triangle |
| `--color-feedback-error-border` | `#8f2e2e` | `#e5484d` | Bordure pleine |
| `--color-feedback-error-bg` | `#2b1212` | `transparent` | **Aucun remplissage** (précédent : `--color-action-secondary-bg`) |
| `--color-border-error` | `#f87171` | `#e5484d` | Champ invalide |
| `--color-action-danger-bg` *(nouveau)* | — | `#b92c2c` | Bouton destructif plein |
| `--color-action-danger-bg-hover` *(nouveau)* | — | `#c93636` | Survol |
| `--color-action-danger-bg-active` *(nouveau)* | — | `#a32424` | Appui |
| `--color-text-on-danger` *(nouveau, alias)* | — | `var(--color-text-primary)` | Texte du bouton (jamais de blanc pur) |
| `--color-decorative-progress` | `#f61c0d88` | `#cc1a0d` | Barre décorative du héros, **opaque** (seul rouge à canal alpha du dépôt) |

États : désactivé (`aria-disabled`) ⇒ `bg-action-disabled-bg text-text-disabled`, jamais rouge ; focus
⇒ `--color-focus-ring` inchangé. Forme : pilule INFLUX (on emprunte la couleur, pas la géométrie, `20` §1).

**Contrastes calculés (WCAG 2.x)** :

| Paire | Ratio | Seuil |
|---|---|---|
| `#ec5d5e` sur `surface-page #0a0a0a` / `surface-card #131315` / `surface-raised #1a1a1d` | 5,93 / 5,56 / 5,20 | 4,5 ✔ |
| `#e5484d` (bordure) sur page / carte / surélevée | 5,06 / 4,74 / 4,44 | 3 ✔ |
| `#f5f5f7` sur `#b92c2c` / `#c93636` / `#a32424` | 5,58 / 4,75 / 6,80 | 4,5 ✔ |
| Bouton `#b92c2c` sur page | 3,26 | 3 ✔ |

`#e5484d` n'est pas retenu pour le texte (4,44 sur `surface-raised`, sous AA).

**Usages à reprendre** : `account-classes.ts` l. 24-29 (`DESTRUCTIVE_BUTTON_CLASSES` ⇒ bouton plein ;
ajouter `DANGER_NOTICE_CLASSES`) ; `auth/auth-classes.ts` l. 65-68 et `backoffice/.../auth-classes.ts`
l. 58-60 (`ERROR_CLASSES`, effet par les tokens) ; `SessionsScreen.tsx` l. 189, 208 (deviennent rouges
pleins) ; `ShortVideoOverlay.tsx` l. 69 (effet par le token).

## 6. Découpage (commits livrables, dans l'ordre)

| # | Commit | Qui | Contenu |
|---|---|---|---|
| 0 | — | `architecte` | Valide en amont : fonction de dépôt et son propriétaire, contrat `erasure_authorised`, lecture de l'adresse pour l'e-mail (DZ-3) |
| 1 | `feat(privacy): self-service account erasure, no admin approval (D72)` | `expert-database` (migration `0150`) + `dev-react-node` | §2.1 à §2.5, contrat, fiche backoffice en lecture seule, e-mail `privacy.erasure_completed` FR/EN, tests T1 à T9 |
| 1b | `feat(leads): delete the Apollo contact on account.deleted` | `expert-integrations-api` | Remplace le `skip erasure_not_propagated` ; sinon la demande reste ouverte dès qu'Apollo a reçu le contact (DZ-8) |
| 2 | `feat(account): danger zone and solid red` | `dev-react-node` | §3 et §5, tests T10 à T14 |
| 3 | `feat(ui): error messages with an alert icon, no red fill` | `dev-react-node` | Composant `ErrorNotice` (web et backoffice) : icône triangle `aria-hidden` + texte, `role="alert"` conservé ; remplacement des `<p role="alert" className={ERROR_CLASSES}>` (88 occurrences, 29 fichiers). Test T15 |

Avant chaque commit : suite complète (`CLAUDE.md` §7 r. 5).

## 7. Critères d'acceptation et tests

| # | Critère vérifiable | Test |
|---|---|---|
| T1 | Dépôt `erasure` avec code frais valide ⇒ une transaction : demande `in_progress` canal `self_service`, exécution `member_fresh_code` sans 2V, **toutes** les sessions du compte révoquées, cookie effacé, registre `privacy.execution_authorised_by_member` ; **aucune** ligne `dual_control_requests`, aucun e-mail `privacy.request_received` | `test:db` `tm1-data-requests-route` |
| T2 | Code `data_export`, expiré ou déjà consommé ⇒ `reauthentication_required`, rien n'est créé ; dépôt `access` inchangé (accusé, approbation `admin` requise) | Idem |
| T3 | CHECK : `member_fresh_code` + `access` refusé ; `member_fresh_code` avec 2V refusé ; `admin_dual_control` sans 2V refusé ; approbateur = sujet refusé ; aucun rôle membre n'insère dans `request_executions` (`42501`) | `test:db` `t8-privacy-execution` + T2 matrice |
| T4 | Tour du worker ⇒ compte `deleted` et anonymisé (`04` §9.2 + `0137`), sessions supprimées, `account.deleted` P0 Brevo et Apollo, `access` ouverte close `retiree_par_le_demandeur`, export effacé, e-mail `privacy.erasure_completed` en file dans la langue du compte | `t8-privacy-execution` |
| T5 | Brevo en échec ⇒ compte **quand même** anonymisé et fermé ; ligne `failed` rejouable ; demande ouverte ; après rejeu réussi + `messageId` + GoTrue supprimé ⇒ close `satisfaite`, `propagation_email` à `NULL` | `t8-privacy-execution`, `tm1-brevo-connector` |
| T6 | Aucun rôle d'exécution `BYPASSRLS` ; E-5 jamais sur `influx_worker_login` (T4.3 existant, vert) | `t4-roles` |
| T7 | E-mail `privacy.erasure_completed` : textes FR/EN exacts, aucun lien, aucune adresse web ni e-mail dans le corps, aucune donnée hors date | Test unitaire du rendu (modèle de `data-request-received-email.test.ts`) |
| T8 | Fiche backoffice : suppression libre-service affichée en lecture seule, sans bouton d'approbation ; l'export garde le sien | Test backoffice + `backoffice.spec.ts` |
| T9 | Après exécution, réinscription de la même adresse ⇒ compte nouveau (CA31) | `t8-data-requests-and-reports` ou e2e |
| T10 | Parcours e2e : Zone de danger ⇒ bouton ⇒ deux listes + mot (mot erroné refusé) ⇒ code ⇒ écran « Votre compte est supprimé », plus aucune page de compte accessible | `apps/web/e2e/account-data.spec.ts` (scénario deletion réécrit) |
| T11 | Section « Zone de danger » / « Danger zone » dernière de « Mes données », encadré + bouton ; `exportFirst` visible si un export est ouvert | Idem |
| T12 | Styles calculés : encadré `background-color` transparent, bordure 1 px `rgb(229, 72, 77)`, texte `rgb(236, 93, 94)`, `<strong>` présent ; bouton `rgb(185, 44, 44)` ; axe sans violation FR/EN ; aucun défilement horizontal à 375 px | e2e |
| T13 | Garde « rouge opaque » : dans les deux `tokens.css`, les tokens du §5 sont des hex à 6 chiffres, `transparent` ou `var()` ; aucune classe `*-error-*/NN` ni `*-danger-*/NN` ; ratios du §5 recalculés depuis le fichier ≥ seuils ; valeurs identiques web/backoffice | `apps/web/tests/guards.test.ts` (bloc G3b) + équivalent backoffice |
| T14 | Parité des clés FR/EN ; clés retirées absentes des deux langues | Test de parité existant |
| T15 | Commit 3 : chaque erreur `role="alert"` rend l'icône triangle `aria-hidden` et son texte ; `bg-feedback-error-bg` n'apparaît plus hors du composant | Tests unitaires du composant |

## 8. Spécifications à amender (dans le commit qui les implémente)

| Document | Où | Amendement |
|---|---|---|
| `decisions.md` | Nouvelle ligne | **D72** (texte en tête de fiche) |
| `15` | RG75 étape 6, **RG76**, RG77, RG85 | Exception : effacement **déposé depuis l'espace membre** exécuté sans `admin` après double validation du membre ; étapes 1 à 5 sans objet (identité = code frais, RG74 ; périmètre = §9.2 ; étape 4 = notification système ; réponse = e-mail `privacy.erasure_completed`) ; clôture automatique `satisfaite` ; preuve RG85 = dépôt, code frais, exécution, confirmations, `messageId`. RG72, RG73, RG74, RG79, RG80 inchangées |
| `03` | l. 192 (Compte — supprimer), l. 571 (exécuter une anonymisation), l. 215 C(4), l. 841 (E-5) | Membre : ✔ soi-même · R · J (libre-service) ; E-5 « déclenché par une tâche, après 2V + R d'un `admin`, **ou** après la double validation du membre pour son propre effacement (D72) » |
| `04` | §9.2 | Sessions révoquées au dépôt, exécution au tour suivant du worker ; `authorised_by` ; export et demande `access` ouverts ; règle « toute table personnelle étend E-5 » |
| `05` | l. 857 | « Re-authentification par code, puis anonymisation **automatique** » ; RG57 inchangée |
| `16` | §H ter, RG160 | RG160 limitée à `access` (variantes `erasure` retirées) ; nouvelle RG `privacy.erasure_completed`, texte exact FR/EN |
| `17` | §6.3 (l. 1748-1817) | Zone de danger, encadré « immédiate et définitive », écran final ; confirmation en deux temps **maintenue** |
| `17b` | §3.12 (l. 1390-1434) | Effacement libre-service : lecture seule, sans étapes 1 à 6 |
| `runbooks/demandes-rgpd.md` | En-tête « Règle d'or », §1, §5, §7 | Exception D72 ; reste manuel : échec définitif de propagation, adresse réutilisée (F1), canaux hors espace membre |
| `21` | l. 103 (EC-14) | « Suppression : exécution automatique après double validation du membre (D72) » |
| `18` | Plan de test | Cas T1 à T9 |
| `20` §10, skill `design-system-influx` l. 68 | Charte | Tokens du §5, règle « pas de rouge translucide ; bordure pleine + icône + texte ; bouton destructif plein » |

Puis `pnpm docs:index`.

## 9. Décisions ouvertes

| # | Question | Défaut appliqué | Arbitre |
|---|---|---|---|
| **DZ-1** | **Délai de grâce** (par ex. 7 jours annulables) avant l'exécution ? Sans lui, une boîte e-mail compromise suffit à supprimer définitivement un compte (`03` S-2) | **Aucun délai** (demande du fondateur, conforme à `04` §9.2) | Fondateur, après avis `expert-cybersecurite` (revue de fin de jalon) |
| **DZ-2** | Suppression **pendant une affaire ou une mise en relation ouverte** : la bloquer ou la différer ? | **Non bloquante** : affaire et mise en relation conservées pseudonymisées, commission traçable, commercial alerté | Fondateur + `expert-paiement-facturation`, avant le Lot 4 |
| **DZ-3** | E-mail de confirmation envoyé à l'adresse conservée **après** anonymisation | Oui, via `propagation_email` (fenêtre existante, close à la clôture) | **Mécanisme validé par `architecte` le 2026-10-27** (§2.4) ; conformité au Lot 6 |
| **DZ-4** | Valeurs hex du §5 (le skill exige l'accord du fondateur pour toute nouvelle couleur) | Valeurs du §5, calées sur Railway, conformes AA | Fondateur |
| **DZ-5** | Entrée dédiée « Zone de danger » dans la navigation du compte, comme Railway ? | Non : section en bas de « Mes données » | Fondateur, avis `expert-ux` |
| **DZ-6** | Succès, alerte, information gardent un fond teinté : les aligner ? | Non, hors demande | `expert-ux`, puis fondateur |
| **DZ-7** | D72 lève la seule séparation de rôles du MVP portant sur une obligation légale (`15` RG76) et modifie EC-14, arbitré à l'époque avec `expert-conformite-rgpd` | Appliqué sur `main`/`staging` ; revue à l'homologation du Lot 6, **veto possible sur `production`** | Fondateur ; `expert-conformite-rgpd` au Lot 6 |
| **DZ-8** | Apollo : l'API permet-elle la suppression d'un contact ? Sinon, toute suppression d'un compte transmis à Apollo reste ouverte et exige un suivi manuel | **Tranchée (2026-10-28) : non.** L'API Apollo n'expose aucun point de suppression de contact (index `docs.apollo.io/llms.txt` : créer, mettre à jour, consulter, chercher, étapes, propriétaire ; seul « Remove Records from a List » retire d'une liste, sans supprimer). Commit 1b **non codé** ; le `skip erasure_not_propagated` demeure, la demande reste ouverte et exige la suppression manuelle dans l'interface Apollo (alerte §2.5, runbook `demandes-rgpd.md`). À revérifier si Apollo publie un point de suppression | `expert-integrations-api`, validé par `architecte` |

## 10. Risques

- **Irréversibilité sans filet** : plus d'humain entre la demande et l'effacement ; une session ou une boîte
  e-mail compromise suffit (DZ-1). Atténué par le mot à taper, le code frais lié à la session et l'e-mail
  de confirmation.
- **Commission** : une partie peut supprimer son compte en pleine affaire pour sortir de la plateforme ;
  l'affaire et la mise en relation survivent pseudonymisées, mais l'interlocuteur disparaît (DZ-2, D29).
- **Couverture des données** : chaque lot qui ajoute une table personnelle doit étendre E-5 aussitôt
  (règle §4) ; un oubli laisse des données d'un compte « supprimé » sans que personne ne le voie.
- **Apollo** : avec Apollo alimenté dans tous les pays par défaut, sans commit 1b la plupart des demandes
  restent ouvertes (DZ-8).
- **Juridique** : D72 contredit `15` RG76 et la procédure validée le 2026-10-14 ; bloquant possible à
  l'homologation (DZ-7).
- **Visuel** : boutons « Fermer… » de « Mes sessions » en rouge plein ; tous les messages d'erreur du
  backoffice changent d'aspect (axe à vérifier sur `backoffice.spec.ts`).
