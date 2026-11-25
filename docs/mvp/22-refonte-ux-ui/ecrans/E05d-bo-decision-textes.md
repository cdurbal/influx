# E05 — Décision d'une entrée de file : textes
> Suite de `E05-bo-decision.md` (même maquette, mêmes identifiants).

## 4. Textes

EN : aucun (D36). Clés : `apps/backoffice/src/messages/fr.ts`. Apostrophe typographique dans les clés, droite dans la maquette : garder la typographique.

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S01 | Files / Profils marque à valider / {Terre & Thé} ; Fil d'Ariane (nom lu) | aucun | `nav.queues`, `queue.profiles_advertiser` ; nom lu nouveau |
| S02 | {Terre & Thé} | aucun | remplace `queueReview.title` (« Profil marque — {marque} ») |
| S03 | Rendre la main | aucun | `queueReview.decision.release` (« Je rends la main ») : à modifier |
| S04 | Fiche du compte ; Ouvre la fiche : lecture enregistrée | aucun | nouvelles |
| S05 | Première soumission · déposée le {22/11 à 00 h 53} · échéance {08 h 53} · Hors délai depuis {49 min} · prise en charge par vous à {09 h 41} | aucun | `queueList.kinds.submission` ; reste nouveau (proches : `banner.byMe`, `banner.overdue`) |
| S05 | Modification d'un profil publié | aucun | nouvelle (`queueList.kinds.revision` = « Modification ») |
| S06 | Aller à la décision | aucun | nouvelle |
| S07 | À savoir / Aucune alerte sur cette entrée. | aucun | nouvelle / `alerts.none` |
| S08 | Première soumission : tout le profil est à examiner, aucune version validée n'existe encore. | aucun | `written.submission` (« tout le profil ci-dessus… ») : à modifier |
| S09 | Modification d'un profil publié : {2} champs modifiés, {la présentation et le secteur principal}. Le reste est déjà validé. | aucun | nouvelle |
| S10 | À contrôler / public | aucun | nouvelles |
| S11 | Voir la page publique (version soumise) | aucun | nouvelle |
| S12 | Ce que les créateurs liront si vous publiez. À droite, les motifs de refus que chaque élément peut appeler : des questions, jamais un verdict. | aucun | nouvelle (« À droite » faux sous 1280 px) |
| S13 | Nom commercial | aucun | nouvelle (`facts.brandName` = « Nom de la marque ») |
| S13 | Motifs possibles / Nom commercial trompeur ? Doublon d'une marque inscrite ? | aucun | nouvelles |
| S14 | Logo / Aucun logo déposé / Motif possible / Logo non conforme ? | aucun | `sections.logos` / nouvelle (`logo.none` = « Aucun logo ») / nouvelles |
| S15 | Présentation / {81} caractères · langue du compte : {français} / Présentation trop courte ou incompréhensible ? Coordonnée directe ? Contenu illicite ? | aucun | `facts.presentation` ; nouvelles |
| S16 | Secteur principal / Secteurs secondaires : {aucun} / Secteur manifestement incohérent ? | aucun | `facts.primarySector`, `facts.secondarySectors`, `none` ; nouvelle |
| S17 | À rapprocher : thèmes recherchés « {Mode} » et la présentation ci-dessus. | aucun | nouvelle |
| S19 | Modifié | aucun | nouvelle |
| S20 | Avant : {ancienne valeur} | aucun | nouvelle |
| S21 | Ce qu'elle recherche / Thèmes recherchés / Réseaux et formats / Pays d'audience visés / Marchés visés / Langues de travail | aucun | titre nouveau ; `facts.topics`, `facts.audienceCountries`, `facts.targetMarkets`, `facts.workingLanguages` ; « Réseaux et formats » nouveau |
| S22 | Entreprise et conditions / Taille de l'entreprise / Droits d'usage / {aucun} | aucun | titre nouveau ; `facts.companySize`, `facts.usageRights` |
| S23 | Non renseignés : {site web, secteurs secondaires, exclusivité, rythme de collaboration, contreparties non monétaires}. | aucun | nouvelle |
| S24 | Compte / interne / {Belgique} · compte en {français} · responsable : {Julien} · fonction de l'interlocuteur : {Marketing} · profil complet à {80 %} | aucun | nouvelle |
| S25 | Interlocuteur de la marque / Vue identifiée · lecture enregistrée à {09 h 41} / Prénom / Adresse e-mail / Téléphone | aucun | `sections.contact` ; chapeau nouveau ; `contact.firstName`, `contact.email`, `contact.phone` |
| S25 | Visible des agents INFLUX seuls, jamais d'une marque ni d'un créateur (D45, D46). | aucun | `contact.lead` (plus long) : Q14 |
| S26 | Historique de l'entrée / {2} événements / {22/11 00 h 53} · Déposée par la marque / {22/11 09 h 41} · Prise en charge par {Camille D.} | aucun | nouvelles |
| S27 | Décision | aucun | `sections.decision` |
| S28 | Deux issues : publier, ou refuser avec un motif. La décision porte sur la version affichée. | aucun | `decision.lead` (« …affichée ici ») |
| S28 | Commentaire interne (facultatif) / Visible des seuls agents INFLUX : jamais de la marque, ni dans l'e-mail. / {0} / 1 000 caractères | aucun | `decision.comment` (à modifier), `decision.commentHelp`, compteur nouveau |
| S29 | Valider | aucun | `decision.publish` |
| S30 | Refuser avec motif | aucun | `decision.reject` |
| S31 | valider / refuser / rendre la main / annuler sans perdre la saisie | aucun | nouvelles (`shortcuts.keys` d'un seul tenant aujourd'hui) |
| S32 | Publier ce profil ? / Le profil de {Terre & Thé} sera publié tel qu'affiché ici, et la marque en sera informée par e-mail, en {français}. / Commentaire interne joint : « {texte} » / Confirmer la publication / Annuler | aucun | `decision.publishTitle`, `publishRecap`, `publishCommentRecap`, `publishConfirm`, `cancel` ; `publishRevisions` conservé |
| S33 | Motif du refus (liste fermée) / {8 libellés} | aucun | `decision.reasonLegend`, `decision.reasonLabels` |
| S34 | Message envoyé à la marque : choisissez un motif pour le voir. | aucun | `decision.messageToBrand` + nouvelle |
| S34 | {message servi} {suite servie} | aucun | `reasons[].message`, `reasons[].nextStep` ; le texte composé de la maquette n'est pas repris |
| S35 | Choisissez un motif avant de refuser. | aucun | `decision.reasonRequired` |
| S36 | Refuser / Annuler | aucun | `decision.reasonConfirm`, `decision.cancel` |
| S38 | Rendre la main et revenir à la file ? / Votre commentaire interne sera perdu. L'entrée redevient libre pour vos collègues. / Rendre la main / Garder la main | aucun | proches : `verificationReview.release.*` ; à unifier |
| S39 | Profil publié à {09 h 47}. La marque est prévenue par e-mail. | aucun | `decision.publishedNotice` (texte différent) |
| S39 | Profil refusé à {heure}, motif : {motif en minuscules}. La marque est prévenue par e-mail. | aucun | `decision.rejectedNotice` (texte différent) ; `decision.lateMark` conservé |
| S40 | Entrée suivante : {Vélo Urbain Bruxelles} / Revenir à la file | aucun | nouvelle / `chain.emptyBack` |
| S41 | Raccourcis de la décision / Valider (ouvre le récapitulatif) / Ouvrir le choix du motif (ne refuse jamais seul) / Rendre la main et revenir à la file / Confirmer depuis le commentaire / Fermer sans perdre la saisie / Fermer | aucun | `shortcuts.*` (à adapter) ; touches `v`, `r`, `l`, `Ctrl Entrée`, `Échap` ; `?` absent de la liste dessinée |
| Annonces | {texte de S39} Entrée suivante proposée : {nom}. / Choisissez un motif avant de refuser. / Vous avez rendu la main. | aucun | nouvelles |
