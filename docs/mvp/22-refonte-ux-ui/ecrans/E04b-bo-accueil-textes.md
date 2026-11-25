# E04 — Tableau de bord du backoffice : textes, écart et données
> Suite de `E04-bo-accueil.md` (même maquette, mêmes identifiants).

## 4. Textes

EN de toute la table : aucun (D36). Clés : `apps/backoffice/src/messages/fr.ts`. Apostrophe typographique (’) dans les clés, droite (') dans la maquette : garder la typographique.

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S03 | LOCAL — development — envois : redirigés vers les adresses internes | aucun | `shell.environment` + `environmentBanner` |
| S04 | {Prénom N.} · Commercial | aucun | `shell.identity` (e-mail, « commercial ») : à modifier |
| S07 | INFLUX / Backoffice | aucun | `shell.name`, `shell.product` |
| S09 | Tableau de bord | aucun | `nav.dashboard` |
| S10 | Files | aucun | `nav.queues` |
| S11 | {n} hors délai (nom lu) | aucun | nouvelle (`17b` : `bo.shell.overdue`) |
| S12 | Profils et visuels / Vérifications / Campagnes et sélections / Fonctionnement / Obligations et contrôles | aucun | nouvelles |
| S13 | Profils marque / Profils créateur / Visuels de portfolio / Campagnes | aucun | nouvelles (libellés courts ; `nav.*Queue` actuels plus longs) |
| S13 | Vérifications créateurs / Vérifications marques / Contestations / Identifiants modifiés / Sélections par l'équipe | aucun | `nav.verificationCreators`, `nav.verificationBrands`, `nav.verificationDisputes`, `nav.identifierChanges`, `nav.teamSelectionQueue` |
| S14, S35 | vide | aucun | nouvelle |
| S15 | Échecs de synchronisation / Actions à valider | aucun | nouvelles |
| S16 | Comptes / Créateurs / Administration | aucun | `nav.accounts`, `nav.creatorSearch`, `nav.admin` |
| S17 | Raccourcis | aucun | `queueList.shortcutsButton` |
| S18 | Se déconnecter | aucun | `shell.signOut` |
| S21 | Tableau de bord | aucun | remplace `home.title` (« Espace interne ») ; `home.lead` supprimé |
| S22 | Arrêté à {09 h 41} | aucun | nouvelle (format d'heure : Q16) |
| S23 | Actualiser | aucun | nouvelle |
| S24 | À traiter maintenant | aucun | nouvelle |
| S25 | {4} entrées hors délai | aucun | nouvelle (singulier à écrire) |
| S26 | {nom} · {file} / depuis {49 min} | aucun | nouvelle |
| S27 | Mes prises en charge ({2}) | aucun | nouvelle |
| S28 | prise à {09 h 28} | aucun | nouvelle |
| S29 | Aucune entrée hors délai, aucune prise en charge en cours. | aucun | nouvelle |
| S30 | Files / Délai de décision : {8 h} ouvrées | aucun | `nav.queues` ; proche de `queueList.policy` |
| S31 | File / En attente / Plus ancienne / Hors délai / Sans preneur | aucun | nouvelles |
| S32 | Profils marque à valider / Profils créateur à valider / Visuels de portfolio à modérer / Vérifications créateurs / Vérifications marques / Contestations de badge / Identifiants modifiés / Campagnes à valider / Sélections par l'équipe / Échecs de synchronisation / Actions en attente de validation | aucun | `queue.*` ; diffèrent aujourd'hui : « Vérifications des créateurs », « Vérifications des marques », « Identifiants modifiés à contrôler », « Sélections par l’équipe INFLUX » ; deux dernières nouvelles |
| S37 | Alertes · {18}, en {7} groupes | aucun | `home.alertsTitle` + nouvelle |
| S38 | Recherche de créateurs : {12} refus pour débit dépassé (recherche ou ouverture de profil) en 24 heures. | aucun | `alert.cause.rate_limited` (« sur 24 heures » aujourd'hui) |
| S38 | File Brevo en retard : {50} envois hors délai sur 24 heures. | aucun | `alert.cause.queue_late` |
| S38 | Le dernier rapprochement Brevo a trouvé {4} désinscriptions non reçues par le webhook. | aucun | `alert.cause.unsubscribe_gap` |
| S38 | {1} demande de sélection par l'équipe INFLUX hors délai : prenez-la en charge ou clôturez-la avec un motif. | aucun | `alert.cause.selection_past_deadline` |
| S38 | Recherches des marques bloquées par le seuil d'anonymat : {44} % des recherches de première page sur 7 jours. | aucun | `alert.cause.k_blocked_share` (suite de phrase en plus aujourd'hui) |
| S38 | Les compteurs de masse critique ne sont plus recalculés : les chiffres affichés sont ceux du dernier calcul réussi. | aucun | `alert.cause.counters_stale` (texte différent) |
| S38 | depuis {23 h 47} / depuis le {01/01} | aucun | nouvelle (`alert.line` écrit « Alerte {code} — … (depuis le …) ») |
| S39 | Voir les {12} comptes / et {8} autres | aucun | nouvelles |
| S40 | État des services / Ouvrir la file / Réglages de la recherche | aucun | `ServicesLink` / `alert.openTeamSelection` / `alert.openSearchSettings` (« Ouvrir les réglages de la recherche ») |
| S41 | SÉCU / Connexion de {Camille} depuis un nouveau navigateur ({Chrome sur Windows}). / Ce n'était pas moi | aucun | remplacerait `alert.newBrowser` ; lien nouveau (Q11) |
| S42 | Aujourd'hui · {22/11/2026}, jour UTC | aucun | `home.countersTitle` (« Aujourd'hui ({jour}, jour UTC) ») |
| S43 | Inscrits / {28} · {8} marques, {20} créateurs / Principaux pays / {Belgique 13 · France 13 · Suisse 1 · Luxembourg 1} | aucun | `home.signups`, `home.countries` (« autres pays : n » en plus) |
| S44 | Brevo en moins d'1 h / Apollo en moins de 24 h / {0} % ({0} sur {2}) / Échecs à traiter / Brevo {0} · Apollo {0} · Voir les échecs | aucun | `home.share`, `home.failures`, `home.seeFailures` (libellés plus longs) |
| S45 | Raccourcis / Tableau de bord / Files / Comptes / Ligne suivante, précédente / Ouvrir (prend en charge) / Cette aide / Fermer | aucun | nouvelles ; touches `g t`, `g f`, `g c`, `j k`, `Entrée`, `?` |
| Annonce | Tableau de bord actualisé à {heure} : {une nouvelle entrée dans Profils marque à valider}. | aucun | nouvelle ; variantes (aucun changement, plusieurs files) non écrites par la maquette |

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Coquille, bande, bandeaux, focus | `Shell.tsx`, `shell-classes.ts` | conservés ; identité changée ; bouton Raccourcis ajouté | faire évoluer |
| Rail | `BoNav.tsx`, `bo-nav.ts` : liste plate de 9 files sous l'entrée active | surtitres, libellés courts, compteurs, total, hors délai, 2 files techniques | faire évoluer |
| Accueil | `HomeScreen.tsx` : trois cartes `SECTION_CLASSES` | quatre sections sans carte | faire évoluer |
| `QueueSummary.tsx` | phrases, 5 files | tableau C58 de 11 lignes | supprimer, remplacer |
| Alertes | une boîte `WARNING_CLASSES` par alerte | lignes regroupées par code, détail C26 | faire évoluer |
| Raccourcis | panneau en bas de chaque écran (`QueueTemplate.tsx:653-697`) | dialogue C27 partagé | créer, puis supprimer les panneaux |
| Fil d'Ariane | absent | dans la coquille, par écran | créer |
| Tokens | `--size-property-label` (13 rem), `--spacing-bo-panel-w` (22 rem) absents de `tokens-backoffice.css` | ajoutés | créer |

**Données requises**

| Donnée | Servie aujourd'hui ? | Écart |
|---|---|---|
| Compteurs profils marque, vérifications (2), contestations, identifiants | oui, `GET /v1/bo/queues/counters` (`queues-routes.ts:251`) | aucun |
| Compteurs profils créateur, visuels, campagnes, sélections | oui, mais portés par chaque liste : `creator-queues.ts:95, 269, 303`, `campaign-review.ts:158, 295`, `backoffice-queues.ts:658, 690` | 4 appels de plus, ou extension du contrat (EC-L2G-11-1) : Q01 |
| Échecs de synchronisation : nombre | `accounts/counters.unhandledFailures` (Brevo, Apollo) | « plus ancienne », « hors délai » non servis : Q01 |
| Actions à valider : nombre, ancienneté | `GET /v1/bo/dual-control`, administrateur seul, liste entière | pas de compteur : Q01, Q06 |
| Entrées hors délai, toutes files, nommées | par file seulement (`overdue=true`) | lecture transverse : Q02 |
| Mes prises en charge | par file seulement (`holder=me`) | lecture transverse : Q02 |
| Prénom et initiale de l'agent | non : `me` = `email`, `role` (`backoffice-auth.ts:266-277`) | Q07 |
| Noms des comptes d'une alerte AL21 | non : `accountId` seul (`backoffice-actions.ts:673`) | Q10 |
| Regroupement par code | non : une alerte par compte | calcul d'affichage, aucune règle métier |
| Instant d'arrêt | `asOf` (files), `evaluatedAt` (alertes) ; rien pour `accounts/counters` | afficher le plus ancien des trois, ou un seul instant servi : Q01 |

Hors lot : recherche globale et compteur d'alertes de la bande (`17b` §1.4), entrées Affaires et Alertes du rail, blocs Mes affaires, Ma semaine, Mon activité (Lot 5) ; demandes de contact (Lot 4).

