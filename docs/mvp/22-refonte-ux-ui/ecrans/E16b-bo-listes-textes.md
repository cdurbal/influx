# E16 — Listes des files et des inscrits : textes
> Suite de `E16-bo-listes.md` (même maquette, mêmes identifiants).

## 4. Textes

EN : aucun (D36). Clés : `apps/backoffice/src/messages/fr.ts`. Apostrophe typographique conservée.

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| E16.1-S01 | Files / Profils marque à valider | aucun | `nav.queues`, `queue.profiles_advertiser` |
| E16.1-S02 | Profils marque à valider | aucun | `queue.profiles_advertiser` ; autres files : `queue.*` |
| E16.1-S02 | Première soumission, ou modification d'un champ d'un profil publié : prenez l'entrée en charge, lisez-la, puis publiez ou refusez. | aucun | `queueList.lead` ; autres files : `*.lead` actuels |
| E16.1-S03 | {6} en attente / plus ancienne {9 h 55} / {1} hors délai / {5} sans preneur / · délai de décision {8 h} ouvrées, prise en charge {4 h} ouvrées | aucun | proches : `queueList.pending`, `oldest`, `overdue`, `unclaimed`, `policy` (textes différents) |
| E16.1-S04 | Filtres de la file (nom lu) | aucun | `queueList.filters` |
| E16.1-S05 | Hors délai seuls | aucun | `queueList.overdueOnly` |
| E16.1-S07 | Verrou : tous / Responsable : tous / Alerte : toutes / Origine : toutes / Pays : tous | aucun | `queueList.holder`, `owner`, `alert`, `kind`, `country` ; valeurs « tous / toutes » nouvelles (`all` = « Tous ») |
| E16.1-S08 | Période de dépôt | aucun | `queueList.period` |
| E16.1-S10 | {6} entrées · triées par échéance, la plus proche d'abord | aucun | remplace `queueList.resultsSorted` |
| E16.1-S10 | {1} entrée sur {6}, filtre « Hors délai seuls » · triées par échéance, la plus proche d'abord | aucun | nouvelle |
| E16.1-S11 | Marque / Échéance / Origine / Pays / Complétude / Responsable / Verrou | aucun | `queueList.columns.*` |
| E16.1-S13 | marque semblable publiée | aucun | `queueList.alerts.duplicate_brand` (« Marque semblable déjà publiée ») : court à écrire pour les 4 codes |
| E16.1-S14 | hors délai · {49 min} / dans {2 h 56} | aucun | remplace `dueOverdue` (« HORS DÉLAI depuis … ») / `dueIn` |
| E16.1-S15 | Première soumission / Modification · {présentation} | aucun | `queueList.kinds.*` ; champ : `fields` en minuscule, nouveau |
| E16.1-S16 | {80} % / aucun | aucun | `completeness` / nouvelle (`ownerOptions.none` = « Sans responsable ») |
| E16.1-S17 | libre / {Sofia R.} · {09 h 28} | aucun | `lockFree` / remplace `lockSince` (« … depuis … ») ; `lockMe` (« Vous ») conservé |
| E16.1-S19 | {1} à {6} sur {6} · raison sociale non demandée pour ces entrées · une première soumission porte sur tout le profil | aucun | nouvelles (proches : `legalNameUnset`, `wholeProfile`) |
| E16.1-S19 | ligne suivante, précédente · ouvrir (prend en charge) | aucun | remplace `queueList.keys` |
| E16.1-S20 | Page précédente / Page suivante / Première page / Page {n} | aucun | `queueList.pagePrevious`, `pageNext`, `pageFirst`, `page` |
| E16.1-S21 | Aucune entrée à traiter. / La file est vide depuis {10 h 12}. Les nouvelles soumissions s'y rangent par échéance. / Revenir au tableau de bord | aucun | remplace `queueList.empty`, `emptySince` ; nouvelles |
| E16.1-S22 | Raccourcis / Ligne suivante, précédente / Ouvrir l'entrée (la prend en charge) ou la fiche / Cette aide / Fermer | aucun | nouvelles ; touches `j k`, `Entrée`, `?` |
| E16.1-S23 | états | aucun | `queueList.loading`, `noMatch`, `error`, `forbidden`, `pageEmpty` |
| E16.2-S01 | Comptes / Inscrits | aucun | `nav.accounts`, `nav.signups` |
| E16.2-S01 | Membres inscrits et état de leur synchronisation. L'ouverture d'une fiche est enregistrée à votre nom ; la liste ne s'exporte pas, quel que soit le rôle. | aucun | remplace `accounts.lead` + `accounts.noExport` (« La liste ne montre aucune adresse » retiré : Q06) |
| E16.2-S02 | {3} échecs de synchronisation à traiter. / Ouvrir la file | aucun | nouvelles |
| E16.2-S03 | Rechercher par adresse e-mail (invite) / Rechercher par adresse (nom lu) | aucun | `accounts.search` = « Recherche par adresse » : à modifier |
| E16.2-S04 | Rôle : tous / Pays : tous / Langue : toutes / Statut déclaré : tous / Consentement : tous / Période d'inscription | aucun | `accounts.role`, `country`, `language`, `declaredStatus`, `consent`, `period` |
| E16.2-S05 | Une adresse complète : recherche exacte, non enregistrée. Un fragment de 3 caractères au moins : recherche partielle, enregistrée à votre nom (20 par quart d'heure). Le terme n'apparaît jamais dans l'adresse de la page. | aucun | proche de `accounts.searchHelp` (« sans espace » retiré par la maquette : à garder) |
| E16.2-S06 | {28} inscrits · les plus récents d'abord | aucun | nouvelle |
| E16.2-S06 | {1} inscrit pour « {adresse} » · recherche exacte, non enregistrée | aucun | proche : `accounts.searchExact` ; partielle : `searchJournaled` (Q15) |
| E16.2-S07 | {Maison Azur} / Profil {93JMS4} / {c***@example.test} | aucun | nouvelles (données) |
| E16.2-S07 | Inscrit / Rôle / Pays, langue / Consentement / Brevo / Apollo / Responsable / Inscription | aucun | `accounts.columns.*` ; « Inscrit », « Pays, langue » nouveaux |
| E16.2-S08 | Marque · {professionnel} / Créateur · {particulier} / {France} · {français} | aucun | `messages.roles`, `declaredStatus`, `languages` |
| E16.2-S09 | accordé / — | aucun | `accounts.consentGranted`, `common.none` ; « retiré » existe |
| E16.2-S10 | en file / synchronisé / échec / non tenté / exclu par pays | aucun | `syncState` (« en attente » pour pending, « cas normal » pour skipped) : Q11 |
| E16.2-S11 | aucun / {24/11/2026} | aucun | `accounts.unowned` / `formatDate` |
| E16.2-S12 | {1} à {20} sur {28} / {1} sur {1} / ligne · ouvrir la fiche / Page suivante | aucun | nouvelles ; `common.next` |
| E16.2-S13 | états | aucun | `accounts.empty`, `error`, `searchInvalid`, `periodInvalid`, `failure.rateLimited` |
| Annonce | {1} inscrit trouvé. Recherche exacte, non enregistrée. | aucun | nouvelle |
