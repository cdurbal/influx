# Matrice — marque-campagnes (1)

> Produite par script depuis le §3 de chaque fiche (colonne « Spécification » : identifiant de l'élément, à lire
> dans `ecrans/`). Critères : §6 ; tests : §7 de la même fiche.

| Maquette | Écran | Section | Composant | Spécification | Critère d'acceptation | Test |
|---|---|---|---|---|---|---|
| etape-1 `form.wz` | E07.1 | Cadre | C01 C41 | E07.1-S01 | E07.1-CA01 | E07.1-T02 |
| `.wz-head > a.go` | E07.1 | Tête | C11 | E07.1-S02 | E07.1-CA02 | E07.1-T01 |
| `#wz-title` | E07.1 | Tête | C41 | E07.1-S03 | E07.1-CA03 | E07.1-T01 |
| `#wz-count` | E07.1 | Tête | C41 | E07.1-S04 | E07.1-CA03 | E07.1-T01 |
| `.wz-name .badge` | E07.1 | Tête | C13 | E07.1-S05 | E07.1-CA04 | E07.1-T01 |
| `#wz-name` | E07.1 | Tête | C41 | E07.1-S06 | E07.1-CA04 | E07.1-T01 |
| `#segs button` | E07.1 | Tête | C41 | E07.1-S07 | E07.1-CA05 | E07.1-T01 |
| `#wz-time` | E07.1 | Tête | C41 | E07.1-S08 | E07.1-CA06 | E07.1-T01 |
| `#to-check` | E07.1 | Tête | C11 | E07.1-S09 | E07.1-CA07 | E07.1-T01 |
| `#later` | E07.1 | Tête | C11 | E07.1-S10 | E07.1-CA08 | E07.1-T01 |
| `#later-note` | E07.1 | Tête | C17 | E07.1-S11 | E07.1-CA08 | E07.1-T01 |
| `.save--meta` | E07.1 | Tête | C25 | E07.1-S12 | E07.1-CA09 | E07.1-T01 |
| `.wz-foot .save` | E07.1 | Pied | C25 | E07.1-S13 | E07.1-CA09 | E07.1-T01 |
| `#prev` | E07.1 | Pied | C10 | E07.1-S14 | E07.1-CA10 | E07.1-T01 |
| `#next` | E07.1 | Pied | C10 | E07.1-S15 | E07.1-CA10 | E07.1-T01 |
| `.wz-step > header` | E07.1 | Étape | C02 | E07.1-S16 | E07.1-CA11 | E07.1-T01 |
| `.wz-step .layer` | E07.1 | Étape | C14 | E07.1-S17 | E07.1-CA12 | E07.1-T01 |
| `[data-preview]` | E07.1 | Aperçu | C11 | E07.1-S18 | E07.1-CA13 | E07.1-T01 |
| `.pv`, `.feedcard` | E07.1 | Aperçu | C05 C48 | E07.1-S19 | E07.1-CA13 | E07.1-T01 |
| `#f-title` | E07.1 | Champs | C18 | E07.1-S20 | E07.1-CA14 | E07.1-T03 |
| `#f-type` | E07.1 | Champs | C18 | E07.1-S21 | E07.1-CA14 | E07.1-T03 |
| `#f-sum` | E07.1 | Champs | C18 | E07.1-S22 | E07.1-CA14 | E07.1-T03 |
| `#f-brief` | E07.1 | Champs | C18 | E07.1-S23 | E07.1-CA14 | E07.1-T03 |
| `#f-prod` | E07.1 | Champs | C18 | E07.1-S24 | E07.1-CA14 | E07.1-T03 |
| `#f-cat` | E07.1 | Champs | C18 | E07.1-S25 | E07.1-CA14 | E07.1-T03 |
| `details.opt` | E07.1 | Facultatif | C26 | E07.1-S26 | E07.1-CA15 | E07.1-T01 |
| `[aria-labelledby=l-km]` | E07.1 | Facultatif | C18 | E07.1-S27 | E07.1-CA15 | E07.1-T01 |
| `#f-rest` | E07.1 | Facultatif | C18 | E07.1-S28 | E07.1-CA15 | E07.1-T03 |
| `.zone-int #f-ref` | E07.1 | Facultatif | C24 C18 | E07.1-S29 | E07.1-CA16 | E07.1-T01 |
| script `#next` | E07.1 | Manques d'étape | C29 | E07.1-S30 | E07.1-CA10 | E07.1-T01 |
| `#d-nets` | E07.2 | Livrables | C21 | E07.2-S01 | E07.2-CA01 | E07.2-T01 |
| `.deliv__net` | E07.2 | Livrables | C46 | E07.2-S02 | E07.2-CA01 | E07.2-T01 |
| `.deliv__row`, `.qty` | E07.2 | Livrables | C46 | E07.2-S03 | E07.2-CA02 | E07.2-T01 |
| `#rights` | E07.2 | Droits | C22 | E07.2-S04 | E07.2-CA03 | E07.2-T01 |
| `#rights-more` | E07.2 | Droits | C18 | E07.2-S05 | E07.2-CA03 | E07.2-T01 |
| code `CampaignWorkFields.tsx:98-123` | E07.2 | Droits | C23 | E07.2-S06 | E07.2-CA04 | E07.2-T01 |
| `[name=excl]` | E07.2 | Exclusivité | C21 | E07.2-S07 | E07.2-CA05 | E07.2-T01 |
| `#f-rev` | E07.2 | Validation | C18 | E07.2-S08 | E07.2-CA05 | E07.2-T01 |
| `#f-c` | E07.3 | Audience | C23 | E07.3-S01 | E07.3-CA01 | E07.3-T01 |
| `#f-l` | E07.3 | Audience | C23 | E07.3-S02 | E07.3-CA01 | E07.3-T01 |
| `#f-t` | E07.3 | Audience | C23 | E07.3-S03 | E07.3-CA01 | E07.3-T01 |
| `details.opt` | E07.3 | Facultatif | C26 C21 | E07.3-S04 | E07.3-CA02 | E07.3-T01 |
| idem | E07.3 | Facultatif | C21 | E07.3-S05 | E07.3-CA02 | E07.3-T01 |
| `[name=gen]` | E07.3 | Facultatif | C21 | E07.3-S06 | E07.3-CA03 | E07.3-T01 |
| `.stack > .layer` | E07.4 | Produit | C14 | E07.4-S01 | E07.4-CA01 | E07.4-T01 |
| `#sent` | E07.4 | Produit | C21 | E07.4-S02 | E07.4-CA02 | E07.4-T01 |
| `#f-pv` | E07.4 | Produit | C18 | E07.4-S03 | E07.4-CA03 | E07.4-T01 |
| `#f-keep` | E07.4 | Produit | C18 | E07.4-S04 | E07.4-CA02 | E07.4-T01 |
| `#f-ship` | E07.4 | Produit | C18 | E07.4-S05 | E07.4-CA02 | E07.4-T01 |
| `.zone-int` | E07.4 | Interne | C24 | E07.4-S06 | E07.4-CA04 | E07.4-T01 |
| `#rem` | E07.4 | Interne | C21 | E07.4-S07 | E07.4-CA05 | E07.4-T01 |
| `#f-cur` | E07.4 | Interne | C18 | E07.4-S08 | E07.4-CA04 | E07.4-T01 |
| `#band-f` | E07.4 | Interne | C18 | E07.4-S09 | E07.4-CA05 | E07.4-T01 |
| `#f-nb` | E07.4 | Interne | C18 | E07.4-S10 | E07.4-CA04 | E07.4-T01 |
| `.zone-int > p.sm` | E07.4 | Interne | C24 | E07.4-S11 | E07.4-CA04 | E07.4-T01 |
| `.order` | E07.5 | Dates | C51 | E07.5-S01 | E07.5-CA01 | E07.5-T02 |
| `#d1` | E07.5 | Dates | C47 | E07.5-S02 | E07.5-CA02 | E07.5-T01 |
| `#d2` | E07.5 | Dates | C47 | E07.5-S03 | E07.5-CA02 | E07.5-T01 |
| `#d3` | E07.5 | Dates | C47 | E07.5-S04 | E07.5-CA02 | E07.5-T01 |
| `#d4` | E07.5 | Dates | C47 | E07.5-S05 | E07.5-CA02 | E07.5-T01 |
| etape-5 `#d-msg` | E07.5 | Dates | C19 | E07.5-S06 | E07.5-CA03 | E07.5-T01 |
| `#f-req` | E07.5 | Facultatif | C26 C18 | E07.5-S07 | E07.5-CA04 | E07.5-T02 |
| `#f-max` | E07.5 | Facultatif | C18 | E07.5-S08 | E07.5-CA04 | E07.5-T02 |
| verifier `#wz-count`, `#segs` | E07.6 | Tête | C41 | E07.6-S01 | E07.6-CA01 | E07.6-T01 |
| `.wz-meta` | E07.6 | Tête | C41 | E07.6-S02 | E07.6-CA01 | E07.6-T01 |
| `#hvs` | E07.6 | En-tête | C02 | E07.6-S03 | E07.6-CA02 | E07.6-T01 |
| profil-attente `#d86` | E07.6 | Notice D86 | C17 | E07.6-S04 | E07.6-CA03 | E07.6-T02 |
| `#d86 a.go` | E07.6 | Notice D86 | C11 | E07.6-S05 | E07.6-CA03 | E07.6-T02 |
| script `#errsum` (état non capturé) | E07.6 | Manques | C20 | E07.6-S06 | E07.6-CA04 | E07.6-T01 |
| `#errsum-list a` | E07.6 | Manques | C20 | E07.6-S07 | E07.6-CA04 | E07.6-T01 |
| `.stack > p.label` | E07.6 | Carte | C18 | E07.6-S08 | E07.6-CA05 | E07.6-T01 |
| `#pv-final .feedcard` | E07.6 | Carte | C48 | E07.6-S09 | E07.6-CA05 | E07.6-T01 |
| `a.go` | E07.6 | Carte | C11 | E07.6-S10 | E07.6-CA06 | E07.6-T01 |
| `#recap section` | E07.6 | Récapitulatif | C42 | E07.6-S11 | E07.6-CA07 | E07.6-T01 |
| `[data-fix]` | E07.6 | Récapitulatif | C11 | E07.6-S12 | E07.6-CA08 | E07.6-T01 |
| verifier `dl` 1 | E07.6 | Récapitulatif | C07 | E07.6-S13 | E07.6-CA07 | E07.6-T01 |
| `dl` 2 | E07.6 | Récapitulatif | C07 | E07.6-S14 | E07.6-CA07 | E07.6-T01 |
| `dl` 3 | E07.6 | Récapitulatif | C07 | E07.6-S15 | E07.6-CA07 | E07.6-T01 |
| `h3 .layer--internal` | E07.6 | Récapitulatif | C14 | E07.6-S16 | E07.6-CA09 | E07.6-T01 |
| `dl` 4 | E07.6 | Récapitulatif | C07 | E07.6-S17 | E07.6-CA09 | E07.6-T01 |
| `dl` 5 | E07.6 | Récapitulatif | C07 | E07.6-S18 | E07.6-CA07 | E07.6-T01 |
| `.missing` | E07.6 | Récapitulatif | C20 | E07.6-S19 | E07.6-CA07 | E07.6-T01 |
| code `CampaignSubmitPanel.tsx:145-185` | E07.6 | Déclaration | C21 C17 | E07.6-S20 | E07.6-CA10 | E07.6-T03 |
| `#send` | E07.6 | Actions | C10 | E07.6-S21 | E07.6-CA11 | E07.6-T01 |
| `#back5` | E07.6 | Actions | C10 | E07.6-S22 | E07.6-CA08 | E07.6-T01 |
| `#send-help` | E07.6 | Actions | C18 | E07.6-S23 | E07.6-CA03 | E07.6-T02 |
| code `CampaignSubmitPanel.tsx:203-246` | E07.6 | Retour d'envoi | C17 | E07.6-S24 | E07.6-CA12 | E07.6-T01 |
| envoyee `.page-head` | E07.7 | En-tête | C11 C02 | E07.7-S01 | E07.7-CA01 | E07.7-T01 |
| `.badge--info`, `#sent-at` | E07.7 | En-tête | C13 | E07.7-S02 | E07.7-CA01 | E07.7-T01 |
| `.notice--success` | E07.7 | Notice | C17 | E07.7-S03 | E07.7-CA02 | E07.7-T01 |
| `.steps-next` | E07.7 | La suite | C51 | E07.7-S04 | E07.7-CA02 | E07.7-T01 |
| `.actions .btn` | E07.7 | Actions | C10 | E07.7-S05 | E07.7-CA03 | E07.7-T01 |
| `.actions .go` | E07.7 | Actions | C11 | E07.7-S06 | E07.7-CA03 | E07.7-T01 |
| script `go` | E07.7 | Annonce | C29 | E07.7-S07 | E07.7-CA01 | E07.7-T01 |
| etape-1 `form.wz` | E10.1 | Cadre | C01 C41 | E10.1-S01 | E10.1-CA01 | E10.1-T02 |
| `#wz-title` | E10.1 | Tête | C41 | E10.1-S02 | E10.1-CA02 | E10.1-T01 |
| `#wz-count` | E10.1 | Tête | C41 | E10.1-S03 | E10.1-CA02 | E10.1-T01 |
| `.wz-name` | E10.1 | Tête | C13 | E10.1-S04 | E10.1-CA02 | E10.1-T01 |
| `#segs` | E10.1 | Tête | C41 | E10.1-S05 | E10.1-CA03 | E10.1-T01 |
| `#wz-time` | E10.1 | Tête | C41 | E10.1-S06 | E10.1-CA02 | E10.1-T01 |
| `#to-check` | E10.1 | Tête | C11 | E10.1-S07 | E10.1-CA03 | E10.1-T01 |
| `#later`, `#later-note` | E10.1 | Tête | C11 C17 | E10.1-S08 | E10.1-CA04 | E10.1-T01 |
| `[data-save]` | E10.1 | Tête, pied | C25 | E10.1-S09 | E10.1-CA04 | E10.1-T01 |
| `.wz-foot` | E10.1 | Pied | C10 | E10.1-S10 | E10.1-CA05 | E10.1-T01 |
| `.wz-step > header` | E10.1 | Étape | C02 | E10.1-S11 | E10.1-CA02 | E10.1-T01 |
| `.layer` | E10.1 | Étape | C14 | E10.1-S12 | E10.1-CA06 | E10.1-T01 |
| `[data-preview]`, `.pv .bcard` | E10.1 | Aperçu | C11 C05 | E10.1-S13 | E10.1-CA07 | E10.1-T01 |
| `#logo-up` | E10.1 | Logo | C33 C18 | E10.1-S14 | E10.1-CA08 | E10.1-T03 |
| `#logo-btn` | E10.1 | Logo | C10 | E10.1-S15 | E10.1-CA08 | E10.1-T03 |
| `#logo-soft` | E10.1 | Logo | C19 | E10.1-S16 | E10.1-CA08 | E10.1-T03 |
| `#f-name` | E10.1 | Identité | C18 | E10.1-S17 | E10.1-CA09 | E10.1-T01 |
| `#f-country` | E10.1 | Identité | C18 | E10.1-S18 | E10.1-CA09 | E10.1-T01 |
| `#f-sec` | E10.1 | Identité | C18 | E10.1-S19 | E10.1-CA10 | E10.1-T01 |
| `#f-size` | E10.1 | Identité | C18 | E10.1-S20 | E10.1-CA09 | E10.1-T01 |
| `#f-pres` | E10.1 | Identité | C18 | E10.1-S21 | E10.1-CA09 | E10.1-T01 |
| `#f-sec2` | E10.1 | Facultatif | C26 C23 | E10.1-S22 | E10.1-CA09 | E10.1-T01 |
| `#f-web` | E10.1 | Facultatif | C18 C14 | E10.1-S23 | E10.1-CA11 | E10.1-T01 |
| `#tags-top` | E10.2 | Attentes | C23 | E10.2-S01 | E10.2-CA01 | E10.2-T01 |
| `#nets` | E10.2 | Réseaux | C21 | E10.2-S02 | E10.2-CA02 | E10.2-T01 |
| `.fmts__net` | E10.2 | Réseaux | C46 | E10.2-S03 | E10.2-CA02 | E10.2-T01 |
| etape-2-vide `#fmts-empty` | E10.2 | Réseaux | C08 | E10.2-S04 | E10.2-CA03 | E10.2-T01 |
| `#f-aud` | E10.2 | Pays | C23 | E10.2-S05 | E10.2-CA01 | E10.2-T01 |
| `#f-mkt` | E10.2 | Pays | C23 | E10.2-S06 | E10.2-CA01 | E10.2-T01 |
| `#f-lang` | E10.2 | Langues | C23 | E10.2-S07 | E10.2-CA01 | E10.2-T01 |
| `[name=rights]` | E10.2 | Facultatif | C26 C22 | E10.2-S08 | E10.2-CA04 | E10.2-T01 |
| `#f-excl`, `#f-rhy` | E10.2 | Facultatif | C18 | E10.2-S09 | E10.2-CA04 | E10.2-T01 |
| `[name=nm]` | E10.2 | Facultatif | C21 | E10.2-S10 | E10.2-CA04 | E10.2-T01 |
| `.zone-int` | E10.3 | Interne | C24 | E10.3-S01 | E10.3-CA01 | E10.3-T01 |
| `.zone-int > p.sm` | E10.3 | Interne | C24 | E10.3-S02 | E10.3-CA01 | E10.3-T01 |
| `#f-role` | E10.3 | Interne | C18 | E10.3-S03 | E10.3-CA02 | E10.3-T01 |
| `#f-first` | E10.3 | Interne | C18 | E10.3-S04 | E10.3-CA02 | E10.3-T01 |
| `.zone-int details` | E10.3 | Interne | C26 | E10.3-S05 | E10.3-CA03 | E10.3-T01 |
| `#f-mail`, `#f-tel` | E10.3 | Interne | C18 | E10.3-S06 | E10.3-CA03 | E10.3-T01 |
| `#f-url` | E10.3 | Interne | C18 | E10.3-S07 | E10.3-CA03 | E10.3-T01 |
| verifier `.wz-head` | E10.4 | Tête | C41 | E10.4-S01 | E10.4-CA01 | E10.4-T01 |
| `#hvs` | E10.4 | En-tête | C02 | E10.4-S02 | E10.4-CA01 | E10.4-T01 |
| script `#errsum` | E10.4 | Manques | C20 | E10.4-S03 | E10.4-CA02 | E10.4-T01 |
| `.label` | E10.4 | Aperçu | C18 | E10.4-S04 | E10.4-CA03 | E10.4-T01 |
| `.bcard` | E10.4 | Aperçu | C04 C33 C38 | E10.4-S05 | E10.4-CA03 | E10.4-T01 |
| `a.go` | E10.4 | Aperçu | C11 | E10.4-S06 | E10.4-CA03 | E10.4-T01 |
| `dl` 1 | E10.4 | Récapitulatif | C42 C07 | E10.4-S07 | E10.4-CA04 | E10.4-T01 |
| `dl` 2 | E10.4 | Récapitulatif | C42 C07 | E10.4-S08 | E10.4-CA04 | E10.4-T01 |
| `dl` 3 | E10.4 | Récapitulatif | C42 C14 | E10.4-S09 | E10.4-CA04 | E10.4-T01 |
| `.missing` | E10.4 | Récapitulatif | C20 | E10.4-S10 | E10.4-CA02 | E10.4-T01 |
| `[data-fix]` | E10.4 | Récapitulatif | C11 | E10.4-S11 | E10.4-CA04 | E10.4-T01 |
| `#send`, `#back3` | E10.4 | Actions | C10 | E10.4-S12 | E10.4-CA05 | E10.4-T01 |
| dernier `p.sm` | E10.4 | Actions | C18 | E10.4-S13 | E10.4-CA05 | E10.4-T01 |
| code `BrandProfileScreen.tsx:289-306` | E10.4 | Retour d'envoi | C17 | E10.4-S14 | E10.4-CA05 | E10.4-T01 |
| envoye `.page-head` | E10.5 | En-tête | C02 C13 | E10.5-S01 | E10.5-CA01 | E10.5-T01 |
| `.notice--success` | E10.5 | Notice | C17 | E10.5-S02 | E10.5-CA01 | E10.5-T01 |
| `.steps-next` | E10.5 | La suite | C51 | E10.5-S03 | E10.5-CA02 | E10.5-T01 |
| `.actions` | E10.5 | Actions | C10 C11 | E10.5-S04 | E10.5-CA02 | E10.5-T01 |
| profil `.page-head__row` | E10.6 | En-tête | C02 C10 | E10.6-S01 | E10.6-CA01 | E10.6-T01 |
| `.row.g2` | E10.6 | En-tête | C33 C13 | E10.6-S02 | E10.6-CA01 | E10.6-T01 |
| `.tasks li` | E10.6 | Tâches | C06 | E10.6-S03 | E10.6-CA02 | E10.6-T01 |
| `.tstat` | E10.6 | Tâches | C13 | E10.6-S04 | E10.6-CA02 | E10.6-T01 |
| `.tstat--todo`, `.sub` | E10.6 | Tâches | C06 C13 | E10.6-S05 | E10.6-CA03 | E10.6-T02 |
| code `BrandVerificationBlock.tsx:60-95` | E10.6 | Tâches | C06 | E10.6-S06 | E10.6-CA03 | E10.6-T02 |
| dernier `p` | E10.6 | Aide | C18 | E10.6-S07 | E10.6-CA02 | E10.6-T01 |
| code `ProfileStateNotice.tsx` | E10.6 | État | C17 | E10.6-S08 | E10.6-CA04 | E10.6-T03 |
| modif-2 `#wz-title` | E10.7 | Tête | C41 | E10.7-S01 | E10.7-CA01 | E10.7-T01 |
| `#wz-time` | E10.7 | Tête | C41 | E10.7-S02 | E10.7-CA01 | E10.7-T01 |
| `.wz-name` | E10.7 | Tête | C13 | E10.7-S03 | E10.7-CA02 | E10.7-T01 |
| `#next` | E10.7 | Pied | C10 | E10.7-S04 | E10.7-CA01 | E10.7-T01 |
| code `brand-profile-view.ts:497-520` | E10.7 | Champs | C19 | E10.7-S05 | E10.7-CA03 | E10.6-T03 |
| liste `.camp` | E12.1 | Cadre | C01 | E12.1-S01 | E12.1-CA01 | E12.1-T03 |
| `.page-head h1` | E12.1 | En-tête | C02 | E12.1-S02 | E12.1-CA01 | E12.1-T01 |
| `.btn--primary` | E12.1 | En-tête | C10 | E12.1-S03 | E12.1-CA02 | E12.1-T02 |
| `#g-todo` | E12.1 | À faire | C03 C16 | E12.1-S04 | E12.1-CA03 | E12.1-T01 |
| `#g-cur` | E12.1 | En cours | C03 C16 | E12.1-S05 | E12.1-CA03 | E12.1-T01 |
| `#g-done` | E12.1 | Terminées | C26 C16 | E12.1-S06 | E12.1-CA04 | E12.1-T01 |
| `.r-title a.cover` | E12.1 | Ligne | C06 | E12.1-S07 | E12.1-CA05 | E12.1-T01 |
| `.st .badge` | E12.1 | Ligne | C13 | E12.1-S08 | E12.1-CA06 | E12.1-T01 |
| `.st .sub` | E12.1 | Ligne | C06 | E12.1-S09 | E12.1-CA07 | E12.1-T01 |
| `.date` | E12.1 | Ligne | C06 | E12.1-S10 | E12.1-CA08 | E12.1-T01 |
| `.chev` | E12.1 | Ligne | C06 | E12.1-S11 | E12.1-CA05 | E12.1-T03 |
| `.why span` | E12.1 | À corriger | C19 | E12.1-S12 | E12.1-CA09 | E12.1-T01 |
| `.why a` | E12.1 | À corriger | C11 | E12.1-S13 | E12.1-CA09 | E12.1-T01 |
| liste, ligne 2 | E12.1 | Brouillon | C13 C06 | E12.1-S14 | E12.1-CA07 | E12.1-T01 |
| En cours, ligne 1 | E12.1 | Validation | C13 C06 | E12.1-S15 | E12.1-CA07 | E12.1-T01 |
| liste, En cours ligne 2 | E12.1 | Publiée | C13 C06 | E12.1-S16 | E12.1-CA07 | E12.1-T01 |
| pause | E12.1 | En pause | C13 C06 | E12.1-S17 | E12.1-CA07 | E12.1-T01 |
| `.is-done` | E12.1 | Terminée | C13 | E12.1-S18 | E12.1-CA04 | E12.1-T01 |
| un-brouillon `p.sm` | E12.1 | Note | C18 | E12.1-S19 | E12.1-CA10 | E12.1-T01 |
| neuve `.notice` | E12.1 | Neuve | C17 | E12.1-S20 | E12.1-CA11 | E12.1-T02 |
| `.notice .go` | E12.1 | Neuve | C11 | E12.1-S21 | E12.1-CA11 | E12.1-T02 |
| `.empty` | E12.1 | Neuve | C08 C04 | E12.1-S22 | E12.1-CA12 | E12.1-T02 |
| `.m-state` | E12.1 | Colonne | C56 | E12.1-S23 | E12.1-CA11 | E12.1-T02 |
| publiee `.r-grid` | E18.1 | Cadre | C01 C40 | E18.1-S01 | E18.1-CA01 | E18.1-T03 |
| `.crumb` | E18.1 | Tête | C11 | E18.1-S02 | E18.1-CA02 | E18.1-T01 |
| `.rhead h1` | E18.1 | Tête | C02 | E18.1-S03 | E18.1-CA02 | E18.1-T01 |
| `.rhead .badge` | E18.1 | Tête | C13 | E18.1-S04 | E18.1-CA03 | E18.1-T01 |
| `.rhead p.row` | E18.1 | Tête | C02 | E18.1-S05 | E18.1-CA04 | E18.1-T01 |
| idem | E18.1 | Tête | C02 | E18.1-S06 | E18.1-CA04 | E18.1-T01 |
| `.rhead > p.sm` | E18.1 | Tête | C18 | E18.1-S07 | E18.1-CA03 | E18.1-T01 |
| `.notice--info` | E18.1 | Tête | C17 | E18.1-S08 | E18.1-CA03 | E18.1-T01 |
| `.notice--warning` | E18.1 | Tête | C17 | E18.1-S09 | E18.1-CA05 | E18.1-T02 |
| `.notice .btn--primary` | E18.1 | Tête | C10 | E18.1-S10 | E18.1-CA05 | E18.1-T02 |
| `.ess` 1 | E18.1 | L'essentiel | C35 | E18.1-S11 | E18.1-CA06 | E18.1-T01 |
| `.ess` 2 | E18.1 | L'essentiel | C35 | E18.1-S12 | E18.1-CA06 | E18.1-T01 |
| `.ess` 3 | E18.1 | L'essentiel | C35 | E18.1-S13 | E18.1-CA06 | E18.1-T01 |
| `.ess` 4 | E18.1 | L'essentiel | C35 | E18.1-S14 | E18.1-CA07 | E18.1-T01 |
| `#brief`, `#more` | E18.1 | Brief | C03 C26 | E18.1-S15 | E18.1-CA08 | E18.1-T01 |
| `#h-exp + .bullets` | E18.1 | Attendu | C65 | E18.1-S16 | E18.1-CA09 | E18.1-T01 |
| 2e `.bullets` | E18.1 | Attendu | C65 | E18.1-S17 | E18.1-CA09 | E18.1-T01 |
| `#h-cond + dl` | E18.1 | Conditions | C07 | E18.1-S18 | E18.1-CA09 | E18.1-T01 |
| `#h-who + dl` | E18.1 | Pour qui | C07 | E18.1-S19 | E18.1-CA09 | E18.1-T01 |
| `.zone-int` | E18.1 | Budget | C24 C07 | E18.1-S20 | E18.1-CA07 | E18.1-T01 |
| `#hist` | E18.1 | Historique | C53 | E18.1-S21 | E18.1-CA10 | E18.1-T01 |
| `.box .big` | E18.1 | Encadré | C39 | E18.1-S22 | E18.1-CA11 | E18.1-T01 |
| `.who` | E18.1 | Encadré | C33 | E18.1-S23 | E18.1-CA12 | E18.1-T01 |
| `.box p.sm` | E18.1 | Encadré | C18 | E18.1-S24 | E18.1-CA12 | E18.1-T01 |
| `.box .btn--secondary` | E18.1 | Encadré | C10 | E18.1-S25 | E18.1-CA13 | E18.1-T04 |
| `.box` | E18.1 | Encadré | C10 | E18.1-S26 | E18.1-CA13 | E18.1-T01 |
| `.rare` 1 | E18.1 | Gestes | C26 C10 | E18.1-S27 | E18.1-CA14 | E18.1-T02 |
| `.rare` 1 | E18.1 | Gestes | C26 C10 | E18.1-S28 | E18.1-CA14 | E18.1-T02 |
| `#cl-ok`, `#cl-go` | E18.1 | Gestes | C26 C21 C10 | E18.1-S29 | E18.1-CA15 | E18.1-T02 |
| `.mbar` | E18.1 | Barre | C39 | E18.1-S30 | E18.1-CA16 | E18.1-T03 |
| `.m-acts` | E18.1 | Suivi mobile | C03 | E18.1-S31 | E18.1-CA16 | E18.1-T03 |
| script `#cl-go`, `proto:state` | E18.1 | Annonce | C29 | E18.1-S32 | E18.1-CA14 | E18.1-T02 |
