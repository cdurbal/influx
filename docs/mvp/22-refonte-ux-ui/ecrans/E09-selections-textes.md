# E09 — Sélections (marque) : textes
> §4 de `E09-selections.md`, séparé pour la taille. Les autres sections y sont.

## 4. Textes

Clés dans `apps/web/src/locales/{fr,en}/creator-search.json` (espace `creatorSearch`).

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| E09.1-S01 | Mes sélections | My selections | `lists.title` |
| E09.1-S02, S04 | Nouvelle sélection | New selection | `lists.form.title` |
| E09.1-S03 | Privées : aucun créateur n'est prévenu et rien ne sort d'INFLUX. | à écrire (expert-marketing) | nouvelle (proche : `lists.explain`) |
| E09.1-S05 | Nom de la sélection | Name of the selection | `lists.form.name` |
| E09.1-S06 | Campagne (facultatif) ; Sans campagne | Campaign (optional) ; No campaign | `lists.form.campaign`, `lists.noCampaign` |
| E09.1-S07 | Donnez un nom à la sélection. | Give the selection a name. | `lists.problem.empty` |
| E09.1-S08 | Créer la sélection ; Annuler | Create the selection ; Cancel | `lists.form.create`, `list.delete.cancel` |
| E09.1-S12 | Sans campagne ; {campagne} ; {n} créateurs | No campaign ; {campaign} ; {n} creators | `lists.noCampaign`, `lists.count` (ICU) |
| E09.1-S12 | modifiée hier ; 12 nov. ; aujourd'hui ; à l'instant ; aucun créateur | à écrire (expert-marketing) | nouvelles, donnée absente (E09-Q2) |
| E09.1-S13 | Gardez ici les créateurs qui vous plaisent ; Touchez le cœur d'un profil dans la recherche : il rejoint votre sélection. Vous pourrez comparer les profils, y ajouter vos notes et demander l'avis de l'équipe INFLUX. | à écrire (expert-marketing) | nouvelles (proche : `lists.empty`) |
| E09.1-S14 | Chercher des créateurs | Search for creators | `lists.toSearch` |
| E09.1-S15 | Proposée par INFLUX ; État cible, à spécifier : … | — | hors lot |
| E09.1, annonces | Sélection « {nom} » créée. | à écrire (expert-marketing) | nouvelle (proche : `lists.form.created`) |
| E09.2-S01 | Mes sélections | My selections | `list.back` |
| E09.2-S02, S04 | Renommer la sélection ; Changer la campagne | à écrire (expert-marketing) | nouvelles |
| E09.2-S03, S05 | Nom de la sélection ; Campagne ; Enregistrer ; Annuler | Name of the selection ; Campaign (nouvelle) ; Save ; Cancel | `lists.form.name`, `list.edit.save`, `list.delete.cancel` |
| E09.2-S04 | Campagne : {titre} | Campaign: {title} | `lists.campaign` |
| E09.2-S06 | {n} créateurs · privée : aucun créateur n'est prévenu, vos notes ne sont lues que par vous. | à écrire (expert-marketing) | nouvelle (proche : `list.explain`) |
| E09.2-S07 | Ajouter depuis la recherche | à écrire (expert-marketing) | nouvelle |
| E09.2-S08 | Affichage ; Cartes ; Tableau | à écrire (expert-marketing) | nouvelles |
| E09.2-S09, S12 | Profil {alias} ; {réseau} · {tranche} abonnés | Profile {alias} | `creatorProfile.alias.name` ; voir E02-Q4 |
| E09.2-S09 | Visuel du portfolio de Profil {alias} | à écrire (expert-marketing) | nouvelle (E02-Q9) |
| E09.2-S10, S17 | Audience vérifiée | Verified audience | `filters.badge.audience_verified` (date : E02b-Q4) |
| E09.2-S11 | Retirer Profil {alias} de la sélection | à écrire (expert-marketing) | nouvelle (proche : `list.remove`) |
| E09.2-S12 | Profil vérifié | à écrire (expert-marketing) | nouvelle (X2) |
| E09.2-S13, S14 | Modifier la note ; + Ajouter une note privée | à écrire (expert-marketing) | nouvelles |
| E09.2-S15 | Votre note (privée) ; {n} / 500 caractères ; Lue par vous seule ; Enregistrement… ; Enregistrée à {heure} ; Terminer | Your note (private) ; counter | `list.note.label`, `list.note.counter` ; reste nouveau |
| E09.2-S16 | Comparaison des créateurs de la sélection ; Créateur ; Réseau principal ; Abonnés ; Rythme ; Commentaires ; Pays ; Thématique ; Votre note | à écrire (expert-marketing) | nouvelles |
| E09.2-S16 | {tranche} / publ. ; — | à écrire (expert-marketing) | nouvelle ; valeurs `reference.*` |
| E09.2-S18 | Gérer la sélection | à écrire (expert-marketing) | nouvelle |
| E09.2-S19 | Supprimer cette sélection ? Elle ne pourra pas être récupérée. Aucun créateur n'est prévenu. ; Oui, supprimer | Delete this selection? It cannot be recovered. No creator is told. ; Yes, delete | `list.delete.confirm`, `list.delete.yes` |
| E09.2, annonces | Profil {alias} retiré de la sélection. ; Sélection renommée. ; Campagne enregistrée. ; Sélection supprimée. | à écrire (expert-marketing) | nouvelles |
| E09.3-S01 | Et ensuite ? ; Envoyez cette sélection à l'équipe INFLUX : elle verra les profils de cette sélection, et votre commercial revient vers vous avec une proposition. | à écrire (expert-marketing) | nouvelles (RG61.6) |
| E09.3-S01, S02 | Demander une sélection à l'équipe INFLUX | Ask the INFLUX team for a selection | `request.link`, `selectionRequest.title` |
| E09.3-S03 | Joindre cette sélection : {nom} ({n} créateurs). Vos notes restent privées. | à écrire (expert-marketing) | nouvelle |
| E09.3-S04 | Campagne concernée (facultatif) ; Aucune | Campaign concerned (optional) ; No campaign | `selectionRequest.campaign` ; « Aucune » : `campaign.none` (« Aucune campagne ») |
| E09.3-S05 | Votre besoin en quelques mots (facultatif) | Your need in a few words (optional) | `selectionRequest.message` |
| E09.3-S05 | Le type de profils, le ton, le calendrier. N'indiquez ni e-mail ni téléphone : tout passe par INFLUX. | The kind of profiles, the tone, the schedule. Give no e-mail or phone number: everything goes through INFLUX. | `selectionRequest.messageHelp` |
| E09.3-S05 | 0 / 1 000 caractères | {count} / {max} characters | `selectionRequest.counter` |
| E09.3-S06 | L'équipe INFLUX verra les profils de cette sélection ; votre commercial revient vers vous avec une proposition. Aucun créateur n'est prévenu. | à écrire (expert-marketing) | nouvelle (RG61.6) |
| E09.3-S07 | Envoyer ma demande ; Annuler ; Envoi en cours… | Send my request ; Cancel ; Sending… | `selectionRequest.submit`, `list.delete.cancel`, `selectionRequest.sending` |
| E09.3-S08 | Votre demande est transmise à l'équipe INFLUX. Elle vous répondra d'ici le {date}. Ce délai est celui de la réponse de l'équipe, pas un nombre de profils garanti. | Your request has been passed to the INFLUX team ; The INFLUX team will answer you by {date}. ; This is the team's time to answer… | `selectionRequest.sent.title`, `.text`, `.note` (trois clés fusionnées ; la fin de `.note`, « Aucun créateur n'est prévenu », disparaît de la maquette) |
| E09.3-S09 | Les profils joints sont figés dans la demande : vous pouvez continuer à modifier votre sélection. | à écrire (expert-marketing) | nouvelle |
| E09.3, annonce | Votre demande est transmise à l'équipe INFLUX. Réponse d'ici le {date}. | à écrire (expert-marketing) | nouvelle |

Valeurs fictives : noms des sélections, campagnes, alias, notes, dates, échéance. Refus : `shortlist.refusal.*`, `selectionRequest.refusal.*` (existants, conservés).
