# E02 — Recherche de créateurs (marque) : textes
> §4 de `E02-recherche.md`, séparé pour la taille. Les autres sections y sont.

## 4. Textes

Clés dans `apps/web/src/locales/{fr,en}/creator-search.json` (espace `creatorSearch`).

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S01 | Créateurs | Creators | `page.title` |
| S02 | Demander une sélection à l'équipe INFLUX | Ask the INFLUX team for a selection | `request.link` |
| S03 | Critères de recherche | Search criteria | `filters.title` |
| S04, S36 | Filtres | Filters | `filters.open` |
| S06 | Pays d'audience : {pays} | Audience country: {country} | `criteria.country` |
| S07 | Retirer le critère : {libellé} | Remove the criterion: {label} | `criteria.remove` |
| S08 | Thématique | à écrire (expert-marketing) | nouvelle |
| S09, S39 | Réseaux | Networks | `facets.F3` |
| S10, S40 | Tranche d'audience | Audience band | `facets.F4` |
| S11 | Audience vérifiée | Verified audience | `filters.badge.audience_verified` |
| S12 | Environ 10 à 24 profils correspondent à votre recherche | About 10 to 24 profiles match your search. | `bands.10_24` (point final en plus) ; `bands.5_9`, `25_49`, `50_plus` |
| S13 | Liée à | à écrire (expert-marketing) | nouvelle (`campaign.label` = « Recherche liée à » reste le nom accessible) |
| S13 | aucune campagne | No campaign | `campaign.none` (« Aucune campagne » : casse différente) |
| S14 | Tri ; Pertinence ; Audience ; Vérifiés d'abord ; Nouveaux profils | Sort ; Relevance ; Audience ; Verified first ; New profiles | `sort.label`, `sort.*` |
| S15 | Ce n'est pas un score | à écrire (expert-marketing) | nouvelle |
| S15 (`title`) | « Pertinence » met en tête les profils qui répondent à plus de vos critères. Ce n'est pas un score. | à écrire (expert-marketing) | nouvelle ; texte complet actuel : `sort.explain` |
| S16 | Ma sélection privée | à écrire (expert-marketing) | nouvelle (`panel.title` contient le nombre) |
| S17 | Résultats de la recherche | Search results | `results.title` |
| S18 | Visuel {n} sur {total} du portfolio de Profil {alias} | à écrire (expert-marketing) | nouvelle (E02-Q9) |
| S19 | Audience vérifiée | Verified audience | `filters.badge.audience_verified` |
| S19 | Disponible sous 2 semaines | à écrire (expert-marketing) | nouvelle (existante : `creatorProfile.offer.availability.lt_2w` « Disponible sous moins de 2 semaines ») |
| S19 | Nouveau profil | à écrire (expert-marketing) | nouvelle (existante : `vigilance.recent_profile` « Profil récent. ») |
| S20 | Ajouter Profil {alias} à ma sélection ; Retirer Profil {alias} de ma sélection | à écrire (expert-marketing) | nouvelles |
| S21 | Visuel précédent ; Visuel suivant | à écrire (expert-marketing) | nouvelles |
| S23 | Profil {alias} | Profile {alias} | `creatorProfile.alias.name` |
| S24 | Profil vérifié | à écrire (expert-marketing) | nouvelle (X2) |
| S27 | {réseau} · {tranche} abonnés | à écrire (expert-marketing) | nouvelle ; tranche courte : voir E02-Q4 |
| S28 | Proposé car | Suggested because | `reasons.title` ; raisons : `reason.*` |
| S29 | Page 1 sur 2 | — | interdit (E02-Q1) ; existante : `results.page` « Page {page} » |
| S29 | Page suivante ; Pages de résultats | Next page ; Pages of results | `results.next`, `results.pager` |
| S31 | Recherche en cours… | Searching… | `results.loading` |
| S32 | Votre recherche est trop précise pour être affichée. | Your search is too narrow to be displayed. | `tooNarrow.title` |
| S32 | Élargissez un critère, ou demandez une sélection à l'équipe INFLUX. | Widen a criterion, or ask the INFLUX team for a selection. | `tooNarrow.text` |
| S33 | Retirer la part d'audience | Remove the share of the audience | `tooNarrow.loosen` (autres : `tooNarrow.remove`) |
| S34, S35 | Demander une sélection | Request a selection | `meta.request` (titre d'onglet) : nouvelle clé de lien |
| S35 | Ma sélection | My selection | `list.title` |
| S35 | Voir | à écrire (expert-marketing) | nouvelle |
| S36 | Fermer | à écrire (expert-marketing) | nouvelle dans `creatorSearch` |
| S37 | La recherche se fait par critères, pour protéger l'anonymat des créateurs. | Search works by criteria, to protect creators' anonymity. | `page.explain` |
| S38 | Thématique principale ; Toutes | Main topic ; All | `facets.F1` ; `filters.all` (« Tous ») : accord à écrire |
| S41 | Pays d'audience ; Part de l'audience dans ce pays | Audience country ; Share of the audience in this country | `facets.F6`, `facets.F6s` |
| S41 | Part : toutes ; 10 % et plus ; 30 % et plus | — | faux (E02-Q3) ; `creatorProfile.preview.share.ge_80`, `.50_80`, `.lt_50` |
| S42 ; S43 ; S44 | Langues de publication ; Formats ; Badges | Publication languages ; Formats ; Badges | `facets.F8`, `.F11`, `.F17` |
| S44 | Compte vérifié ; Audience vérifiée | Verified account ; Verified audience | `filters.badge.*` |
| S45 | Tout effacer ; Voir les résultats | Clear all ; See the results | `filters.clear`, `filters.apply` |
| S46 | Profil {alias} ajouté à « Ma sélection » ({n} créateurs). ; Profil {alias} retiré de « Ma sélection » ({n} créateurs). | à écrire (expert-marketing) | nouvelles (nom de la liste en variable, pluriel ICU) |
| S46 | Environ 10 à 24 profils correspondent à votre recherche. | About 10 to 24 profiles match your search. | `bands.10_24` |

Valeurs fictives : alias, titres, thématiques, raisons, campagne « Routine éclat d'hiver ». Le texte `filters.noFreeText` n'est plus affiché par la maquette (E02-Q12).
