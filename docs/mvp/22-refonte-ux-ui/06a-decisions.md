# 06a — Décisions à prendre

> Chaque décision regroupe des questions des fiches (§9 de chaque `ecrans/E…`, qui portent les références
> exactes). **Rien n'est tranché ici** : la colonne « Recommandation » attend l'arbitre. Une fois tranchée, la
> décision s'écrit dans `decisions.md` et la spécification concernée **avant** le code (règle d'or).
> Écarts, anomalies, API et spécifications : `06b-ecarts-et-anomalies.md`.

**Total** : 45 décisions ; 387 questions dans les fiches, dont 171 bloquantes pour leur écran, toutes rattachées ci-dessous. **Aucune acceptation tacite** : les 216 autres reçoivent une réponse écrite de leur arbitre avant le premier commit d'écran de leur jalon (tâche « spécifications » en tête de jalon) ; sans réponse, la maquette s'applique, sauf règle métier ou réglementaire en vigueur. Celles qui relèvent du fondateur, touchent une couleur ou s'écartent d'une maquette sont remontées ici (RU-39, RU-44). Tout écart accordé s'inscrit dans 06b §7.

## 1. À trancher avant le premier écran

> **Tranché le 2026-11-25 par le fondateur (D87)** : RU-00, RU-20, RU-21 (B), RU-23, RU-24, RU-26, RU-28, RU-30, RU-31, RU-37
> (colonne « État »), puis les écarts signalés « Revient sur un point validé » et, pour RU-35, les filtres laissés de
> côté. Le reste de cette liste est ouvert. **Aucun code sans accord explicite distinct.**
>
> **Tranché le 2026-11-25 (D88 ; F0 « oui partout » de RUA)** : RU-01 et RU-03 à RU-20 (hors RU-02 et RU-14), colonne « État »
> (arbitrages de `jalons/rua/modele-ux.md` et `modele-archi.md`). **RU-02** : part du fondateur tranchée, juriste (D34) à venir ;
> **RU-14** reste ouverte. **RU-27 tranchée (D88 ; F1 de RUA, 2026-11-25)** : « oui à toutes les questions », les huit familles F1 à F8 de la planche de `RUA-06` sont acceptées telles que proposées, aucune ouverte ; écarts de la planche inscrits en `06b` §7.

**RU-00** Identité du lot · **RU-01** Tailles fluides sous KEO (X1) · **RU-02** Marque « vérifié » (X2) · **RU-03** Seuils 640 et 1 536 px (X3) · **RU-04** Couleurs translucides et ombres portées (X4) · **RU-05** Ombre de l'encadré (X5) · **RU-10** Onglets segmentés hors conversation (X6) · **RU-17** Taille du `h1` des pages de compte · **RU-21** Lectures d'API ajoutées · **RU-22** Écritures et migrations demandées · **RU-23** Site web de la marque · **RU-24** Page publique de la marque · **RU-26** Contenus et gestes existants absents des maquettes · **RU-27** États non dessinés · **RU-28** Huit décisions et huit listes de file sans maquette · **RU-30** Textes et affichages réglementaires · **RU-31** Public ou interne · **RU-34** Contenu de la carte et du profil anonyme · **RU-35** Fil et fiche de campagne · **RU-37** Rôle du commercial avant la relation · **RU-39** Gestes des agents · **RU-42** Vignettes du portfolio au backoffice.

## 2. Table des décisions

| ID | Sujet | Arbitre | Écrans | Constat | Recommandation | Revient sur un point validé (07) | Questions rattachées | État |
|---|---|---|---|---|---|---|---|---|
| **RU-00** | Identité du lot | fondateur | tout | Numéro « Lot 3bis », code `RU`, jalons `RUA` à `RUL`, placé avant le Lot 4 (précédents : Lot 6bis ; extras DS, SN, RK). | Accepter. Migrations éventuelles en `0335` et suivants : `04xx` reste au Lot 4. | non | — | **Tranchée** (D87) |
| **RU-01** | Tailles fluides sous KEO (X1) | fondateur, expert-ux | 5b, 8, 18, 2b, 15 | `clamp()`, `text-lead`, `text-heading-3` sont interdits (`20` §11.5, TK7.3). | Trois paliers fixes par rôle (< 768, 768 à 1 023, dès 1 024), égaux au rendu à 375, 1 280 et 1 440 (0,6 px au plus) : titre de fiche 26 / 30 / 34 px ; héros 28 / 32 / 36 ; chiffre clé 18 / 19 / 20 ; chiffre d'encadré 20 / 22 / 24. Écart maximal entre deux paliers : 3,6 px, à 767 px. | oui, taille entre paliers | — | **Écart accordé** (D87) ; part de l'arbitre tranchée (D88) |
| **RU-02** | Marque « vérifié » (X2) | fondateur, juriste (D34), product-owner | 1, 2, 2b, 5b, 8, 9, 13, 14 | Coche seule près d'un nom et badges sans date, contre `20` §11.3 (F3) et `08` RG4, RG10 (défaut bloquant). | Garder l'icône bleue sur la carte photo (validée) **avec** un texte accessible, et le badge daté complet, mention d'authenticité comprise, sur chaque fiche. Amender F3 et RG4 pour la seule carte, ou dater aussi la carte. | non | E01-Q20, E02b-Q4, E05b-Q6 | Ouverte : part du fondateur tranchée (D88, F0 Q6) ; juriste (D34) et `product-owner` à venir |
| **RU-03** | Seuils 640 et 1 536 px (X3) | architecte, expert-ux | formulaires, BO listes | Absents des points de rupture ; toute valeur arbitraire est refusée (CA22). | Déclarer `--breakpoint-form` 640 px et une variante `bo-wide` 1 536 px dans les tokens. Les ramener à 480 ou 768 changerait le rendu entre 480 et 768. | non | — | **Tranchée** (D88) |
| **RU-04** | Couleurs translucides et ombres portées (X4) | fondateur | 2, 9, 13, 2b | Voiles `color-mix` 45, 75, 82 % et ombre `rgba` sur photo : hors `KEO_COLOR_MIX`. | Autoriser des tokens `--effect-photo-*` bornés aux éléments posés sur une photo (contraste garanti par le voile), avec mise à jour de G3i. | non | — | **Tranchée** (D88) |
| **RU-05** | Ombre de l'encadré (X5) | fondateur | 2b, 5b, 8, 15, 18 | `shadow-md` au repos contre « cartes plates » (`20` §11.5). | Amender `20` §11.5 : ombre permise sur l'encadré collant seulement. | non | — | **Tranchée** (D88) |
| **RU-06** | Mouvements hors tokens | expert-ux | 2, 2b, 3, 9 | `scale` 0,9 et 0,96, 900 ms, `brightness(0.85)`. | Tokens dédiés à ces valeurs (`--scale-heart-press`, `--scale-leave`, `--duration-celebrate`, `--effect-media-hover`). | non | — | **Tranchée** (D88) |
| **RU-07** | Avatar à dégradé | expert-ux | 2b, 15, 18 | Dégradé `data-1` (réservé aux graphiques) ; la pastille « 93 » de 2b est de plus interdite (`17` §7.1). | Voir RU-34 pour 2b ; pour le commercial (18) : fond `surface-active` uni, initiales. | non | — | **Tranchée** (D88) ; écart de rendu en `06b` §7 |
| **RU-08** | Fond des cases du code | expert-ux | 11 | La maquette rend `surface-raised` (repli d'un token inexistant) ; un champ KEO est en `surface-page`. | Suivre le rendu de la maquette (`surface-raised`), l'écrire dans `20` §11.8. | non | — | **Tranchée** (D88) |
| **RU-09** | Éléments inertes et désactivés | expert-ux | 15, 21 | Opacité 0,55 et 0,45 : 3,66:1 et 3,72:1 (axe). | État désactivé de la charte (`action-disabled-bg`, `text-disabled`) et phrase adjacente ; aucun `aria-hidden` sur un bouton. | oui, rendu inerte (15, 21) | E15-Q7 | **Écart accordé** (D87) ; part de l'arbitre tranchée (D88) |
| **RU-10** | Onglets segmentés hors conversation (X6) | expert-ux | 3, 7, 9, 10, 11, 15, 20, 21 | Réservés aux canaux depuis D74 (`20` §11.8). | Amender : permis (1) pour un choix de formulaire (`radio` : droits d'usage, langue, oui / non, réseau), (2) pour deux vues d'un **même** contenu (cartes / tableau, avant / après, à traiter / normaux) ; jamais pour des rubriques. | non | — | **Tranchée** (D88) |
| **RU-11** | `surface-active` et texte tertiaire (X7) | expert-ux | 2, 9, 16, 21 | 4,13:1 sur le compteur d'un onglet actif. | Compteur en `text-secondary` ; étendre la liste d'usages de `surface-active`. | non | — | **Tranchée** (D88) |
| **RU-12** | Corrections d'accessibilité sans effet visuel (X8 à X11) | expert-ux | `06b` §3 | Carrousels non focalisables, `dl` mal formée, `aria-label` sur `span`, repères manquants, cibles < 24 px, `h1` absent. | Accepter en bloc : le rendu ne change pas. Les liens de 18,6 px (13) passent à 24 px de haut. | oui, hauteur des liens de 13 | — | **Écart accordé** (D87) ; part de l'arbitre tranchée (D88) |
| **RU-13** | Étoile du compte principal (X12) | fondateur (validée écran 3) | 3, 2b, 15 | `data-3` est réservé aux graphiques. | Amender `20` §11.3 (alias `network-primary`). | non | — | **Tranchée** (D88) |
| **RU-14** | Textes anglais et nouveaux textes (X13) | expert-marketing, puis fondateur | tous les écrans membres | Les maquettes n'existent qu'en français ; chaque fiche liste les clés à écrire. | Textes EN écrits et relus **avant** l'écran (tâche par jalon) ; aucun écran livré en FR seul. Backoffice en FR seul (D36). | non | — | Ouverte |
| **RU-15** | Divergences entre maquettes | expert-ux | 02a, 02b | Même composant, valeurs différentes : grille 17 ou 18 rem, réserve basse 3,75 / 4,25 / 4,5 rem, vide de « Mes campagnes » en carte, badge de rôle en 800 dans la fiche BO, recherche BO sans densité `bo`. | Écran par écran selon sa maquette, sauf la densité `bo` de l'écran 13 (oubli manifeste) et la graisse du badge de rôle. | oui, densité de 13 | E13-Q11 | **Écart accordé** (D87) ; part de l'arbitre tranchée (D88) |
| **RU-16** | Paliers de largeur de libellé | expert-ux | props | 9 largeurs entre 6 et 13 rem. | Garder les valeurs des maquettes par tokens (`03` §3.3). | non | — | **Tranchée** (D88) |
| **RU-17** | Taille du `h1` des pages de compte | fondateur | 14, 20 | 20 px dans les maquettes contre `text-title-page` (24, 28). | Suivre les maquettes pour compte, vérifications et assistants ; l'écrire dans `20` §11.5. | non | E20-Q7 | **Tranchée** (D88) |
| **RU-18** | Partage de composants React entre fronts | architecte | socle | `packages/ui` ne porte que tokens et polices. | Deux implantations de mêmes noms et props (`02a` §0) ; partage réévalué après le Lot 5. | non | — | **Tranchée** (D88) |
| **RU-19** | Backoffice de 768 à 1 023 px | expert-ux | tous BO | Les maquettes gardent le rail ; `02` §21.5, TD6.2 et `17b` §1.7 imposent une bande horizontale. | Garder la bande existante, compteurs compris ; hors comparaison visuelle. | oui, rail sous 1 024 | E04-Q05, E04-Q04 | **Écart accordé** (D87) ; part de l'arbitre tranchée (D88) |
| **RU-20** | Fenêtre trop petite sans page montée (U43) | fondateur, architecte | 19 | Exige JavaScript, interdit par `20` §11.8, `17b` §1.7 et `guards.test.ts` l. 520. | Un seul module autorisé à lire la taille : aucune page montée à l'arrivée dans une petite fenêtre (validé). **Écart à accorder** : une page **déjà** montée avec un verrou ou une saisie reste montée et masquée quand la fenêtre rétrécit, sinon la saisie est perdue. Sans accord : page démontée, avec avertissement. | oui en partie, écran 19 | E19-Q01, E19-Q02 | **Tranchée** (D87) ; mécanisme tranché (D88), livré par `RUC-08` |
| **RU-21** | Lectures d'API ajoutées | fondateur, architecte | 1, 4, 5, 6, 9, 12, 13, 14, 17, 18, 21 | La mission préserve les contrats ; les maquettes affichent des données non servies (`06b` §5). | Option B : jalon `RUD`, **lectures additives seulement** (aucun champ retiré ou renommé, aucune règle changée), droits et journal compris. A : front seul, éléments sans donnée non rendus (écarts assumés). C : repousser les écrans concernés. | oui si A ou C | E02b-Q2, E04-Q01, E04-Q02, E04-Q07, E04-Q10, E05-Q03, E06-Q01, E06-Q02, E06-Q03, E06-Q04, E09-Q2, E12-Q1, E13-Q01, E13-Q02, E13-Q03, E14-Q4, E15-Q3, E17-Q02, E18-Q1, E18-Q5, E21-Q02 | **Tranchée : B** (D87) |
| **RU-22** | Écritures et migrations demandées | fondateur, architecte | 9.3, 21.5 | Sélection jointe (RG61.1 à RG61.6, spécifiée, jamais codée) ; désactivation d'un compte interne (aucune route). | Sélection jointe : à coder comme reliquat de L3G avant E09.3, ou E09.3 livré sans jointure. Désactivation : dessin validé ; soit l'API est spécifiée et codée, soit E21.5 est livré sans ce geste jusqu'au Lot 5 (**écart à accorder**). | oui, écrans 9 et 21 | E09-Q1, E21-Q17 | Ouverte : deux options |
| **RU-23** | Site web de la marque | fondateur | 5b, 10, 8, 18 | Retiré de la vue créateur (07) ; `06` RG15, RG17, RG74 et D40 le disent public ; l'API le sert encore (`campaign-creator-view.ts:101`). | Amender `06` et retirer le champ de la **réponse** créateur (retrait de contrat, à accorder explicitement) ; le masquer au seul écran ne suffit pas (D46). | non | E10-Q1, E05b-Q12 | **Tranchée** (D87) |
| **RU-24** | Page publique de la marque | fondateur, architecte, expert-cybersecurite | 5b, 5, 6, 10, 17 | Aucune route ni lecture ; annuaire de marques interdit (`06` RG4) ; liens du backoffice vers une session membre impossibles ; version soumise. | Route sous une campagne visible (`/campagnes/[id]/marque`) ; campagnes ouvertes limitées à celles que ce créateur voit ; aperçus internes au backoffice, en lecture seule. | oui en partie, liens de 5, 6, 17 | E05b-Q1, E05b-Q2, E05b-Q4, E05b-Q7, E05b-Q13, E05-Q05, E06-Q05, E17-Q03, E10-Q17 | **Tranchée** sur le principe (D87) ; `architecte`, `expert-cybersecurite` |
| **RU-25** | « Ce qui vous concerne » et « Proposé car » d'exemple | expert-matching | 5b, 8, 15 | Aucune règle ni donnée ; D11 interdit tout score. | Deux faits fermés calculés par `apps/api` (thématique, pays d'audience), fonction partagée ; sections de 5b et 8 absentes tant que non servies (**écart à accorder**). Écran 15 : exemple gardé, comme validé, construit des seules valeurs servies (E15-Q2). | oui, écrans 5b et 8 tant que non servi | E05b-Q3, E08-Q3, E15-Q2 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-26** | Contenus et gestes existants absents des maquettes | fondateur, product-owner | 2, 2b, 3, 4, 5, 6, 9, 13, 16, 17, 21 | Champs obligatoires, droits et gestes d'exploitation perdus si la maquette est suivie à la lettre. | Principe : **rien de ce qui est obligatoire, réglementaire ou opérationnel ne disparaît** ; chaque élément prend la place proposée dans sa fiche, validée sur capture. | oui, ajouts à plusieurs écrans | E02-Q5, E02b-Q7, E02b-Q8, E02b-Q10, E02b-Q11, E03-Q1, E03-Q3, E03-Q8, E03-Q15, E04-Q12, E05-Q07, E06-Q07, E06-Q08, E06-Q09, E09-Q11, E13-Q04, E13-Q05, E16-Q08, E17-Q04, E21-Q06, E21-Q08, E21-Q20, E21-Q22, E21-Q24 | **Principe tranché** (D87) ; places sur capture |
| **RU-27** | États non dessinés | expert-ux, fondateur | presque tous | Première visite / actif, refusé, suspendu, révision, verrou perdu, échec, limite, pastille ouverte… | Valider par famille les représentations du §5 des fiches (composants C08, C13, C17, C20) sur la planche livrée par RUA-06, à sa sortie, avant le premier écran. | non, états non dessinés | E01-Q1, E01-Q11, E02-Q10, E02b-Q6, E03-Q13, E03-Q14, E05-Q11, E05c-Q08, E07-Q16, E07-Q18, E09-Q4, E10-Q14, E10-Q15, E12-Q3, E12-Q4, E14-Q8, E14-Q9, E16-Q01, E17-Q07, E18-Q7, E18-Q10 | **Tranchée** (D88, F1 : « oui à toutes les questions », familles F1 à F8 de la planche acceptées) |
| **RU-28** | Huit décisions et huit listes de file sans maquette | fondateur | 5, 16 | 07 : « les huit autres files prennent le même gabarit » ; ordre, colonnes et saisies non dessinés. | Cadre C59 et tableau C58 imposés ; contenu actuel conservé dans l'ordre proposé (`E05c`, `E16` §2) ; validation sur capture avant la clôture du jalon. | non | E05c-Q01, E05c-Q02, E05c-Q03, E16-Q02, E16-Q03 | **Tranchée** (D87) |
| **RU-29** | Délais annoncés | product-owner | 1, 7 | « 8 heures ouvrées », « 1 jour ouvré » en dur ; revue renforcée 2 jours ; `EC-L3B-10-2` (`CampaignSubmitPanel.tsx:11`). | Délai lu dans la configuration, sinon texte sans chiffre. | oui, texte | E01-Q2, E01-Q19, E07-Q17 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-30** | Textes et affichages réglementaires | expert-conformite-rgpd, expert-cybersecurite, fondateur | 3, 11, 14, 16, 20, 21 | Mention repliée, consentement réécrit, réponse neutre retirée, textes d'effacement raccourcis, négations du badge réduites, nom de fichier affiché, adresse masquée. | Garder mot pour mot les textes en vigueur et leur visibilité jusqu'à avis écrit ; la forme suit la maquette. | oui, textes et mention repliée (11, 14, 16, 20) | E03-Q4, E11-Q1, E11-Q6, E11-Q15, E11-Q16, E11-Q17, E14-Q3, E14-Q5, E16-Q06, E20-Q15, E20-Q17, E20-Q18, E21-Q15, E21-Q23 | **Principe tranché** (D87) ; avis RGPD et juriste à venir |
| **RU-31** | Public ou interne | fondateur | 7, 10, 18 | Valeur du produit montrée publique (D78 : interne) ; nature et nombre de créateurs montrés internes (`09` : publics) ; fonction de l'interlocuteur. | Suivre les règles : valeur dans l'encadré interne, nature et nombre hors de l'encadré, fonction en liste fermée publique. **Écart à la maquette à accorder.** | oui, écrans 7, 10, 18 | E07-Q1, E07-Q2, E18-Q4, E10-Q2 | **Tranchée** (D87) |
| **RU-32** | Navigation et mémoire des assistants | product-owner, architecte | 3, 7, 10 | Adresse d'étape, reprise, segments désactivés, formats gardés en mémoire. | Étape dans l'adresse (`?step=`), reprise à la première étape incomplète, navigation libre ; un format décoché n'est pas envoyé. | oui, segments désactivés | E03-Q2, E07-Q8, E07-Q6, E10-Q6 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-33** | Complétude d'un réseau et champs « indispensables » | product-owner | 3 | « Complet », tranches des comptes secondaires, champs montrés indispensables mais facultatifs. | Suivre `missingRequired` ; tranches au seul compte principal ; domaine attendu servi par `packages/domain`. | oui, champs « indispensables » | E03-Q5, E03-Q6, E03-Q7 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-34** | Contenu de la carte et du profil anonyme | expert-matching, product-owner | 2, 2b, 9 | Tranches fausses, badge de photo, 3 visuels (RG50), métriques D61 réduites, pastille stable, ancienneté, pré-remplissage. | Tranches servies seules (forme gardée) ; amender RG47 et RG50 pour le carrousel et la mosaïque validés. Pastille et ancienneté : **écart à accorder** (anonymat, `17` §7.1). | oui, écrans 2 et 2b | E02-Q2, E02-Q3, E02-Q4, E02-Q6, E02-Q7, E02-Q8, E02b-Q1, E02b-Q3, E02b-Q5, E09-Q9 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-35** | Fil et fiche de campagne | fondateur, product-owner | 8 | Filtres différés au Lot 6bis et refusés par l'API ; tri ; valeurs de RG15 retirées ; fiche close inatteignable ; phrase de candidature perdue sur téléphone. | Filtres validés : les livrer demande d'avancer une part du 6bis (API) ; sinon ligne absente (**écart à accorder**). Tri, contenu de la carte : amender RG33 et RG15 pour suivre la maquette, ou compléter la carte (**écart**). Fiche close : dessin validé contre RG24 (même réponse que l'inconnue) : `expert-cybersecurite` d'abord. | oui, écran 8 | E08-Q1, E08-Q2, E08-Q4, E08-Q5, E08-Q7 | **Filtres : laissés de côté** (D87) ; tri, carte, fiche close ouverts |
| **RU-36** | Débordements des maquettes à 375 px | expert-ux | 2, 3, 7 | Pied d'assistant 396 px, barre de recherche recouverte. | « Précédent » réduit à son chevron nommé sous 480 px ; lien raccourci. | oui, sous 480 px | E03-Q9, E07-Q13, E02-Q14 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-37** | Rôle du commercial avant la relation | fondateur | 5b, 18 | Commercial nommé avant toute mise en relation ; phrase « vous propose aux campagnes » (D45). | **Revient sur l'écran 18 validé** : deux options, nommer dès l'attribution (maquette, D45 et D47 à amender) ou « Votre commercial INFLUX » sans nom (recommandé). E18.1-S23 décrit la maquette et suivra le choix. Phrase de 5b corrigée. | oui, écran 18 | E18-Q2, E05b-Q9 | **Tranchée : sans nom** (D87) |
| **RU-38** | Compte et inscription : règles touchées | fondateur, product-owner | 10, 11, 20 | Raison sociale = nom public, statut modifiable, enregistrement au fil de la saisie, zone de danger, médiation retirée, « Changer » absent, autre adresse. | Nom en lecture seule avec lien ; statut du créateur seul ; `17` et D72 amendés pour le repli validé ; le reste selon les fiches. | oui, écrans 11 et 20 | E20-Q1, E20-Q2, E20-Q3, E20-Q16, E10-Q4, E11-Q4, E11-Q18, E11-Q22 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-39** | Gestes des agents | fondateur, product-owner, expert-cybersecurite | 4, 5, 6, 16, 17 | Ordre du dossier, entrée suivante manuelle, raccourcis, code « SÉCU », champs corrigeables, brief tronqué, motifs, brouillon ; retards en orange (maquette) ou en rouge (code, `17b` §6.3) : couleur, fondateur (D6). | Maquette pour l'ordre et l'enchaînement (amender `17b` §2.5, §2.6) ; code et API pour les règles (motif obligatoire, états figés, brief entier). | oui en partie, écrans 4, 5, 17 | E04-Q09, E05-Q01, E05-Q02, E05-Q16, E04-Q08, E04-Q11, E06-Q06, E17-Q01, E17-Q06, E17-Q09 | **Écarts accordés** (D87) ; couleur des retards ouverte |
| **RU-40** | Routes nouvelles | architecte, product-owner | 14, 21 | « Mes vérifications », file des échecs ; code de propriété ouvert par `POST`. | `/compte/verifications` · `/account/verifications` ; `/files/echecs-synchronisation` ; demande ouverte au clic ; « Mes sessions » gardée. | non | E14-Q1, E14-Q2, E21-Q01 | Ouverte |
| **RU-41** | Administration : rejeu, double validation, invitations internes | product-owner, expert-cybersecurite | 21 | Rejeu en un clic contre motif et aperçu (RG101) ; confirmation sans mot de passe (B-5) ; formulaire interne sans maquette. | Règles de sécurité conservées (D84, B-5), forme des maquettes. | oui, écran 21 | E21-Q03, E21-Q04, E21-Q07, E21-Q18 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-42** | Vignettes du portfolio au backoffice | product-owner, expert-cybersecurite | 6 | La lecture d'un visuel est journalisée à la demande (D82, L2G). | Compte et lien, vignettes au geste (**écart à accorder** : vignettes dessinées et validées). | oui, écran 6 | E06-Q13 | **Écart accordé** (D87) ; part de l'arbitre à venir |
| **RU-44** | Questions non bloquantes qui relèvent du fondateur ou s'écartent d'une maquette | fondateur | 2, 7, 16, 18 | Pagination « 1 sur 2 » irréalisable, nombre de squelettes, récapitulatif et fiche partiels, candidatures citées, vues retirées. | Une réponse par question ; la maquette s'applique sans réponse contraire. | oui selon la question | E02-Q1, E02-Q13, E07-Q20, E07-Q25, E16-Q12, E18-Q6 | Ouverte : une réponse par question |
| **RU-43** | Aperçu du créateur | product-owner | 15 | RG104 : « exactement ce que l'API sert ». | Décor inerte annoncé comme tel ; aucune donnée reconstituée. | oui, écran 15 | E15-Q1 | **Écart accordé** (D87) ; part de l'arbitre à venir |

## 3. Questions par fiche

| Fiche | Questions | Bloquantes |
|---|---|---|
| `E01a-accueils.md` | 9 | 2 |
| `E01b-accueils.md` | 11 | 3 |
| `E02-recherche.md` | 16 | 9 |
| `E02b-profil-anonyme.md` | 12 | 10 |
| `E03a-profil-createur-etapes.md` | 7 | 6 |
| `E03b-profil-createur-recap.md` | 9 | 3 |
| `E03c-profil-createur-etapes-4-5.md` | 5 | 3 |
| `E04-bo-accueil.md` | 19 | 9 |
| `E05-bo-decision.md` | 17 | 7 |
| `E05b-page-marque.md` | 13 | 9 |
| `E05c-bo-decisions-derivees.md` | 10 | 4 |
| `E06a-bo-fiche-compte-marque.md` | 15 | 8 |
| `E06b-bo-fiche-compte-createur.md` | 3 | 2 |
| `E07a-campagne-etapes.md` | 8 | 2 |
| `E07b-campagne-envoi.md` | 11 | 3 |
| `E07c-campagne-budget-dates.md` | 6 | 3 |
| `E08-campagnes-createur.md` | 10 | 6 |
| `E09-selections.md` | 12 | 5 |
| `E10a-profil-marque-etapes.md` | 13 | 4 |
| `E10b-profil-marque-suite.md` | 10 | 3 |
| `E11a-entree.md` | 14 | 3 |
| `E11b-entree.md` | 12 | 5 |
| `E12-mes-campagnes.md` | 9 | 3 |
| `E13-bo-recherche.md` | 15 | 6 |
| `E14-verifications.md` | 10 | 7 |
| `E15-apercu.md` | 8 | 4 |
| `E16-bo-listes.md` | 16 | 5 |
| `E17-bo-campagne.md` | 13 | 7 |
| `E18-campagne-marque.md` | 15 | 6 |
| `E19-bo-mobile.md` | 10 | 2 |
| `E20a-compte.md` | 13 | 4 |
| `E20b-compte.md` | 11 | 4 |
| `E21a-bo-admin-synchro-dv.md` | 13 | 7 |
| `E21b-bo-admin-comptes.md` | 12 | 7 |

## 4. Charge d'arbitrage

| Arbitre | Questions | Bloquantes |
|---|---|---|
| product-owner | 146 | 65 |
| expert-ux | 121 | 31 |
| architecte | 56 | 39 |
| fondateur | 25 | 21 |
| expert-conformite-rgpd | 21 | 17 |
| expert-cybersecurite | 17 | 10 |
| expert-marketing | 14 | 1 |
| expert-matching | 14 | 10 |
| testeur | 1 | 0 |

Une question à deux arbitres compte pour chacun.
