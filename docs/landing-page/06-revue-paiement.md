# Landing page INFLUX : revue paiement et facturation

> **Statut :** étape 4 du plan validé par le fondateur le 2026-09-16. Revue rédigée par
> `expert-paiement-facturation` le 2026-09-17.
> **Question posée (00-cadrage §5) :** la section tarifs, la devise et les réponses de FAQ sur
> l'argent respectent-elles CA19 à CA21 ?
> **Documents relus :** `CLAUDE.md` §3, §4.2, §13 (D7, D9, D19, D20, D23, D24, D27) ; skill
> `contract-commission` ; `00-cadrage.md` (CA19 à CA21) ; `04-contenus.md` (tous les textes qui
> parlent d'argent, de paiement, de reversement, de devise, de taxes, d'abonnement ou de gratuité) ;
> `02-ux-wireframes.md` §2.7 et §3.14 ; `01-architecture.md` §6.5.
> **Ce document ne modifie aucun autre fichier.** Les corrections retenues sont à reporter dans
> `04-contenus.md` (et, pour #11, #13 et #18, dans `02-ux-wireframes.md`).

## 1. Verdict

**Objections.**

Sur le fond, l'invariant est respecté : l'identité comptable est exacte, la commission est
présentée comme incluse et jamais ajoutée, les formats FR/EN sont bons et la conception ne prévoit
aucun calcul. Les objections portent sur des formulations qui **engagent INFLUX publiquement sur
des décisions encore ouvertes** (taxes D7, détention des fonds D9, structure de facturation D23,
sort de la commission en cas d'annulation D20) ou qui **laissent un doute sur ce que touche le
créateur** (point sensible de `CLAUDE.md` §4.2).

**Condition de levée :** les points #1 à #12 du tableau (section 3) sont reportés dans
`04-contenus.md` avant l'étape 5. `expert-marketing` peut reformuler en conservant chaque élément
financier et les longueurs maximales ; toute reformulation d'un point **bloquant** (#1 à #4)
repasse par `expert-paiement-facturation`. Les suggestions (#13 à #18) sont laissées à
l'appréciation de `expert-marketing` et `expert-ux`.

## 2. Contrôles conformes

| Contrôle | Résultat |
|---|---|
| Identité comptable | Conforme partout où elle apparaît (section 12, FAQ `commission`, écran du téléphone) : part annonceur 400,00 € + part créateur 300,00 € + net créateur 1 300,00 € = montant du contrat 2 000,00 € ; commission 700,00 € = 35 % ; net = 65 %. Barre : 1/5 + 3/20 + 13/20 = 1. |
| Commission incluse, jamais ajoutée | Conforme : `pricing.rate.included`, `pricing.audience.advertiser`, FAQ `commission`, méthode `securePayment`. Aucune formulation du type « s'ajoute », « en plus », « + 35 % ». Réserve sur le mot « budget » (#16). |
| Mots interdits | Aucun « frais », « sans frais », « hors taxes », « TTC », nom de prestataire, pays ouvert ou délai de reversement. |
| Étiquette et devise sur chaque montant chiffré | Conforme en section 12 et dans la FAQ. Écarts d'étiquetage sur des mentions non chiffrées : #7, #8, #10, #12. |
| Formats FR / EN | Conformes : `2 000,00 €` (U+202F entre milliers, U+00A0 avant `€`) et `€2,000.00` ; `35 %` (U+202F) et `35%` (04 §0, 02 §2.7). |
| Montants dans le contenu fictif | Aucun : chiffre clé, résultat et études de cas ne portent que des indicateurs non monétaires. |
| Calcul dynamique | Aucun : montants en texte statique (01 §6.5, 02 §3.14), barre à largeurs statiques, gabarits ICU réservés aux indicateurs non monétaires. |
| Hypothèse « exemple en euros dans les deux langues » (00 §4) | **Confirmée pour la maquette** : un seul exemple, identique en FR et en EN, n'induit aucune conversion implicite entre les deux versions. Suite au Lot 1 : point T4. |
| Arrondis (D19) | Aucun engagement public ; l'exemple de référence tombe juste. |
| Cohérence FR / EN | Bonne, sauf #5 (vocabulaire anglais du net créateur) et #9 (le « only » de l'anglais absent du français). |

**Réponses aux points P1 à P6 de `04-contenus.md` §4** : P1 conforme, sauf la légende de la barre
(#3 à #5) ; P2 → #1 ; P3 conforme, le silence sur les frais de conversion est correct tant que D27
est ouverte (T4), complément #15 ; P4 → #2 et #6 ; P5 maintenu sous condition (T3) ; P6 maintenu
en section 12 uniquement (T7).

## 3. Points relevés

Longueurs des textes proposés comptées en caractères rendus (espaces et apostrophe `’` compris), à
recompter après report.

| # | Clé | Problème | Gravité | Texte FR proposé | Texte EN proposé |
|---|---|---|---|---|---|
| 1 | `landing.pricing.notes.taxes` (160) | « Les taxes applicables […] sont précisées dans le récapitulatif » promet d'afficher **toutes** les taxes, y compris celles qui relèvent de chaque partie et qu'INFLUX ne peut pas connaître (impôt sur le revenu, cotisations, TVA propre au créateur selon son statut : D23, D24). Placée sous « Montant du contrat (coût total pour l'annonceur) », la note ne dit pas si 2 000,00 € inclut ou non des taxes (D7). Le texte proposé ne tranche ni hors taxes ni taxes comprises et limite l'engagement aux taxes qui s'appliquent au contrat (voir T1). | bloquant | L’exemple ne détaille pas les taxes. Celles qui s’appliquent au contrat dépendent des pays et du statut de chacun ; elles sont indiquées avant la signature. *(156)* | The example doesn’t break down taxes. Taxes that apply to the contract depend on the countries and each party’s status; they are shown before signing. *(150)* |
| 2 | `landing.faq.items.payment.answer` (400) | Trois engagements prématurés dans un texte public opposable : (a) « paie le montant du contrat **à** INFLUX » présente INFLUX comme vendeur du montant total, alors que la structure de facturation n'est pas tranchée (D23) et que l'assiette de TVA en dépend (2 000,00 € ou 700,00 €, D7) ; (b) « prestataire […] qui conserve les fonds » qualifie juridiquement la détention des fonds, à confirmer par un juriste (D9) ; (c) « une fois la publication validée, INFLUX retient sa commission » laisse entendre que la commission n'est acquise qu'à la validation, donc rendue en cas d'annulation (D20). Le texte proposé décrit le flux tranché par D8 sans rien présumer. | bloquant | La marque paie le montant du contrat dans INFLUX, via un prestataire de paiement agréé. Le net créateur, soit le montant du contrat moins la commission INFLUX, est reversé au créateur via ce prestataire après la validation de la publication par la marque. Au premier contrat, le créateur vérifie son identité et renseigne ses coordonnées bancaires auprès du prestataire. *(370)* | The brand pays the contract amount on INFLUX, through a licensed payment provider. The creator’s net amount, meaning the contract amount minus the INFLUX commission, is paid out to the creator through that provider once the brand approves the publication. On their first contract, creators verify their identity and add their bank details with the provider. *(357)* |
| 3 | `landing.pricing.rate.legend.advertiserShare.label` (24) | Isolé dans la légende de la barre, « Part annonceur » ne dit pas qu'il s'agit d'une part **de la commission INFLUX**. La légende est le seul porteur textuel de la barre (`aria-hidden`). Libellé aligné sur l'exemple de référence de `CLAUDE.md` §3 (« Part annonceur INFLUX »). Variante acceptable côté `expert-ux` : regrouper les deux premières pastilles sous l'intitulé « Commission INFLUX 35 % ». | bloquant | Part annonceur INFLUX *(21)* | INFLUX advertiser share *(23)* |
| 4 | `landing.pricing.rate.legend.creatorShare.label` (24) | Même problème que #3, plus grave : placée à côté de « Net créateur 65 % », « Part créateur 15 % » (et surtout « Creator share 15% », qui en anglais désigne couramment la part **touchée** par le créateur) peut se lire comme une rémunération du créateur. C'est exactement l'ambiguïté que `CLAUDE.md` §4.2 interdit. | bloquant | Part créateur INFLUX *(20)* | INFLUX creator share *(20)* |

| 5 | `landing.pricing.rate.legend.netCreator.label` (24) | EN : « Net to creator » est une troisième variante, absente du vocabulaire fixe de 04 §0 (« net paid to the creator » · « creator’s net amount »), qui doit être repris à l'identique dans les écrans du Lot 4. FR conforme. | à corriger | Net créateur *(inchangé)* | Creator’s net amount *(20)* |
| 6 | `landing.method.steps.securePayment.body` (220) | « qui conserve les fonds jusqu’à la validation de la publication » : même qualification juridique non validée que #2 (D9), et « jusqu'à la validation » ignore les cas d'annulation et de litige (D20). « commission incluse » sans « INFLUX ». | à corriger | Le paiement passe par un prestataire de paiement agréé. Le montant payé est celui du contrat, commission INFLUX incluse ; le net créateur est reversé après la validation de la publication. *(188)* | Payment goes through a licensed payment provider. The amount paid is the contract amount, INFLUX commission included; the creator’s net amount is paid out after the publication is approved. *(189)* |
| 7 | `landing.method.steps.contract.body` (220) | « le montant total payé par la marque » : libellé hors vocabulaire (CA21), et « total payé » présume du traitement des taxes (D7). Le contrat doit aussi énoncer la commission **et ses deux parts** (skill `contract-commission`, structure du contrat d'intermédiation). Seconde phrase inchangée. | à corriger | Le contrat indique, dans une seule devise, son montant, la commission INFLUX incluse et ses deux parts, et le net créateur. Il n’est possible qu’entre parties situées dans des pays ouverts aux contrats. *(202)* | The contract states, in a single currency, its amount, the included INFLUX commission and its two shares, and the creator’s net amount. It’s only available when both parties are in countries open to contracts. *(209)* |
| 8 | `landing.whyInflux.items.secureContract.body` (180) | « le montant » et « son net » non étiquetés, « la commission » sans « INFLUX » (CA21) ; le net créateur n'apparaît pas parmi les éléments du contrat. | à corriger | Le contrat affiche son montant, sa devise, la commission INFLUX incluse et le net créateur. Paiement via un prestataire agréé ; net reversé après validation de la publication. *(175)* | The contract shows its amount, currency, the included INFLUX commission and the creator’s net amount. Payment via a licensed provider; net paid out once the content is approved. *(177)* |
| 9 | `landing.pricing.title` (70) | « une commission à la signature » (EN « only when a contract is signed ») peut se lire comme un paiement exigé au moment de la signature, alors que le moment du paiement est ouvert (D20). Le français n'a pas le « only » de l'anglais. | à corriger | Gratuit à l’inscription, commission seulement sur contrat signé *(63)* | Free to join, commission only on signed contracts *(49)* |
| 10 | `landing.pricing.phone.netLabel` (30) | « Vous recevez » / « You receive » promet la somme créditée sur le compte du créateur, qui peut différer du net créateur reversé (conversion par sa banque, D27 ; taxes selon son statut, D7, D23). Revenir au terme défini, sans perdre le « vous ». | à corriger | Votre net créateur reversé *(26)* | Your net amount paid out *(24)* |
| 11 | Nouvelles clés `landing.pricing.phone.commissionLine` (60) et `landing.pricing.phone.sharesLine` (60) | L'écran du téléphone est présenté comme « ce que voit le créateur avant de signer » mais n'affiche ni la commission ni ses deux parts : il servira de modèle à l'écran réel du Lot 4 et contredit la règle de transparence (tout écran distingue montant du contrat, commission INFLUX et ses deux parts, net créateur). Deux lignes à ajouter sous `contractLine`, `aria-hidden` comme le reste de l'écran. Si l'écran ne peut pas les porter (`expert-ux`), la légende #12 doit dire « illustration simplifiée » et la règle reste due au Lot 4. | à corriger | `commissionLine` : Commission INFLUX (35 %) : 700,00 € *(35)* ; `sharesLine` : dont part annonceur 400,00 € et part créateur 300,00 € *(54)* | `commissionLine`: INFLUX commission (35%): €700.00 *(32)*; `sharesLine`: of which advertiser share €400.00 and creator share €300.00 *(59)* |
| 12 | `landing.pricing.phone.caption` (120) | « son net » non étiqueté, « commission » sans « INFLUX » ; à aligner sur le contenu de l'écran après #11. | à corriger | Illustration : avant de signer, le créateur voit le montant du contrat, la commission INFLUX incluse et le net créateur. *(120, à la limite)* | Illustration: before signing, the creator sees the contract amount, the included INFLUX commission and their net amount. *(120, à la limite)* |

| 13 | `landing.pricing.example.check` (70 → 140, à valider par `expert-ux`) | Les quatre montants de la vérification ne sont pas étiquetés (CA21). La proximité du tableau compense à l'écran, mais pas pour une capture partagée ni une lecture isolée. Longueur maximale à relever dans 02 §3.14. | suggestion | Vérification : 400,00 € (part annonceur) + 300,00 € (part créateur) + 1 300,00 € (net créateur) = 2 000,00 € (montant du contrat) *(129)* | Check: €400.00 (advertiser share) + €300.00 (creator share) + €1,300.00 (creator’s net amount) = €2,000.00 (contract amount) *(124)* |
| 14 | `landing.hero.reassurance` (90) | « Commission » sans préciser laquelle : interdit de 02 §3.14, appliqué ici par cohérence, sur le premier écran vu. | suggestion | Inscription gratuite. Commission INFLUX uniquement sur les contrats signés. *(75)* | Free to sign up. INFLUX commission only on signed contracts. *(60)* |
| 15 | `landing.faq.items.currency.answer` (400) | « la commission » → « la commission INFLUX » (vocabulaire fixe). Rien à ajouter sur les frais de conversion tant que D27 est ouverte (T4). | suggestion | Chaque contrat est établi dans une seule devise, choisie parmi la liste proposée par INFLUX : le montant du contrat, la commission INFLUX et le net créateur sont tous exprimés dans cette devise. La plateforme et les contrats sont disponibles en français et en anglais. *(268)* | Each contract uses a single currency, chosen from the list offered by INFLUX: the contract amount, the INFLUX commission and the creator’s net amount are all stated in that currency. The platform and contracts are available in French and English. *(243)* |
| 16 | `landing.method.steps.brief.body` (220) | « budget » seul : un annonceur peut comprendre que la commission viendra s'ajouter à son budget, contraire à l'invariant (incluse, jamais ajoutée). Même question au Lot 2 pour le champ « budget indicatif » (T9). | suggestion | Produit, objectifs, formats, budget (commission INFLUX incluse), période et public visé : vous décrivez votre campagne. L’équipe la relit et la valide avant sa mise en ligne. *(174)* | Product, goals, formats, budget (INFLUX commission included), timing and target audience: you describe your campaign. Our team reviews and approves it before it goes live. *(171)* |
| 17 | `landing.faq.items.messaging.answer` (400), fin de la réponse | « jusqu’au reversement du créateur » : ce qui est reversé est le net créateur. Anglais conforme. | suggestion | Remplacer la fin par : « … jusqu’au reversement du net créateur. » *(+4 caractères)* | *(inchangé)* |
| 18 | `02-ux-wireframes.md` §3.14, schéma mobile du tableau | Le schéma abrège les libellés (« Commission (35 %) », « dont annonceur (20 %) », « dont créateur (15 %) », « Montant du contrat » sans « coût total ») ; « dont créateur (15 %) » recrée l'ambiguïté de #4. La note sous le schéma renvoie bien aux clés, mais `dev-react-node` et `testeur` doivent le savoir. | suggestion | Aucun texte abrégé : libellés complets de 04 §2.14 à toutes les largeurs (320, 375 et 1440 px), sur deux lignes si nécessaire. | Idem pour les libellés EN de 04 §2.14. |

## 4. Points à faire trancher

Aucun de ces points n'empêche la maquette locale d'avancer une fois #1 à #12 reportés. Ils
conditionnent en revanche la **mise en ligne du Lot 1** : les textes sur l'argent seront alors
publics et opposables, et devront être relus par un juriste et un expert-comptable du pays de la
société (D25).

| # | Point | Décision attendue | Recommandation | Qui |
|---|---|---|---|---|
| T1 | Taxes et « coût total pour l'annonceur » (D7, D23, D24) | Garder « coût total pour l'annonceur » tant que D7 est ouverte, et accepter l'engagement public « taxes indiquées avant la signature » (#1). | Garder le terme, qui est celui de `CLAUDE.md` §3. Si D7 retient des montants hors taxes avec taxes en sus, réécrire `pricing.example.contractAmount.label`, `pricing.audience.advertiser`, `faq.items.commission.answer` et le vocabulaire de 04 §0. L'engagement de #1 impose de connaître, **avant la signature**, le pays, le statut (particulier ou professionnel) et, le cas échéant, le numéro de TVA des deux parties : à prévoir dans les profils du Lot 2. | Fondateur + expert-comptable |
| T2 | Sort de la commission en cas d'annulation, de litige ou de remboursement (D20) | Aucun texte public ne dit quand la commission est acquise, si elle est rendue, ni ne promet de remboursement tant que D20 n'est pas tranchée. | Valider les formulations neutres de #2 et #6. Proscrire jusqu'à D20 : « satisfait ou remboursé », « remboursement garanti », « commission prélevée uniquement si… ». | Fondateur |
| T3 | Qui encaisse, qui détient les fonds, qui facture quoi (D9, D23) | Écrire « paie via INFLUX » et non « paie à INFLUX », et ne pas dire qui « conserve les fonds », tant que le rôle réglementaire et la structure de facturation ne sont pas validés. | D'accord avec #2 et #6. « Prestataire de paiement agréé » (04, P5) est maintenu, à une condition : le prestataire retenu à D9 doit être agréé pour chaque pays ouvert ; sinon, retirer « agréé » de la méthode, de la FAQ et du pied de page. | Fondateur + juriste + `expert-conformite-rgpd` |
| T4 | Devise de l'exemple et frais de conversion (D27) | Euros dans les deux langues pour la maquette ; ce qui est affiché au Lot 1. | Euros confirmés pour la maquette. Au Lot 1, après D27 : l'exemple peut être montré dans une autre devise de la liste fermée selon la langue, **avec les mêmes chiffres ronds et la même identité**, jamais sous forme de montant converti. Aucune mention des frais de conversion (ni montant, ni « sans frais ») avant que D27 dise qui les supporte ; ensuite, une phrase dans la FAQ `currency`. | Fondateur |
| T5 | Frais d'encaissement du prestataire de paiement (D9, D20) | Qui supporte les frais du prestataire sur chaque paiement. | L'identité montant du contrat = part annonceur + part créateur + net créateur ne laisse aucune place à ces frais : les promesses de la page (« vous payez le montant du contrat », « net créateur reversé 1 300,00 € ») ne tiennent que si **INFLUX les supporte sur sa commission**. À confirmer explicitement et à chiffrer lors de D9 (ordre de grandeur : quelques pour cent du montant du contrat, à rapporter aux 35 %). | Fondateur |
| T6 | « INFLUX se rémunère uniquement par une commission » et « sans abonnement » (FAQ `signupCost`, 04 F5) | Maintenir cet engagement public. | Le maintenir s'il est vrai au lancement, en sachant qu'il exclut aussi toute marge sur le change et toute refacturation de frais de paiement (T4, T5), pas seulement l'abonnement (D14). À réviser avant tout changement de l'un de ces points. | Fondateur |
| T7 | « avec les taux standard » (section 12, 04 F6) | Évoquer ou non l'existence de taux dérogatoires. | Maintenir la mention en section 12 uniquement : elle est exacte (les deux taux sont des données, avec des dérogations possibles) et protège INFLUX. Aucun taux dérogatoire annoncé publiquement sans décision du fondateur. FAQ `commission` inchangée (elle renvoie aux tarifs). | Fondateur |
| T8 | Règle d'arrondi (D19) | Aucune décision requise pour la page. | Rien à changer : aucun texte ne promet un arrondi. Les CGV du Lot 4 énonceront la règle et l'attribution du reliquat ; le net peut alors s'écarter de 65 % d'une unité monétaire minimale (un centime), ce qui reste compatible avec « soit 65 % ». | `expert-paiement-facturation` (Lot 4) |
| T9 | Tarifs indicatifs des créateurs et budget indicatif des annonceurs (Lot 2, `howItWorks.steps.completeProfile.*`) | Ces montants sont-ils des montants du contrat (commission incluse) ou des nets ? | Toujours des **montants du contrat, commission INFLUX incluse**, avec le net créateur affiché à côté pour le créateur. Sinon la confusion brut / net reviendra à la négociation et au contrat. | Fondateur + `product-owner` + `expert-ux` |
| T10 | Incohérence documentaire | `docs/cadrage-mvp.md`, ligne « Circuit de l'argent (D8) » : « Le prestataire retient les 35 % » ; `CLAUDE.md` §3 : « INFLUX retient les deux parts ». | Aligner `cadrage-mvp.md` sur `CLAUDE.md`. Sans effet sur la page une fois #2 reporté. | `chef-de-projet` |

## 5. Relecture du 2026-09-17

**Périmètre relu :** reports de #1 à #17 dans `04-contenus.md` (révision du 2026-09-17) ; reports de
#3, #4, #11, #13 et #18 dans `02-ux-wireframes.md` (§3.14, §2.7) ; nouvelle signature du pied de
page (R11 / P7) ; textes modifiés après la revue de conformité qui parlent d'argent
(`reassurance.free`, `useCases.items.acquisition.body`, `featuredResult.metricLabel`,
`marketingConsent.labelAdvertiser`, `faq.items.eligibility.answer`).

### Verdict mis à jour

**Sans objection.** Les objections de la section 1 sont levées.

- **#1 à #4 (bloquants)** : repris mot pour mot en FR et en EN (contrôle caractère par caractère).
- **#5 à #17** : reportés conformément aux textes proposés ; le vocabulaire fixe (04 §0) intègre
  « part annonceur INFLUX / INFLUX advertiser share » pour les libellés isolés, et les interdits de
  04 §1 reprennent T2 et T3.
- **02 §3.14** : légende de la barre avec « INFLUX » obligatoire (#3, #4), deux lignes du téléphone
  sous `contractLine` et `aria-hidden` (#11), vérification étiquetée à 140 caractères (#13),
  schémas sans libellé abrégé (#18). Identité toujours exacte sur tous les schémas.
- **R11 / P7, signature du pied de page** : « Sélection, contrat et paiement : la marketplace des
  marques et des créateurs. » / « Selection, contract and payment: the marketplace for brands and
  creators. » **Confirmée** : elle cite le paiement comme une fonction, sans rien dire du prix, des
  frais ni de la détention des fonds. Le rejet de « contrat et paiement compris » est justifié (T5,
  T6).
- **P8** : d'accord, c'est la condition de T3.
- **Autres textes modifiés** : aucun montant, aucune promesse de prix ; « Aucun abonnement :
  l'inscription est gratuite » reste couvert par T6. Aucune objection.

### Écarts restants (mineurs, non bloquants)

Ils ne portent que sur des descriptions internes ou des schémas de `02-ux-wireframes.md`, jamais sur
un texte affiché ; les clés de `04-contenus.md` font foi. À corriger à la prochaine retouche de 02,
sans condition pour l'étape 5.

| Clé | Problème | Texte proposé FR | Texte proposé EN |
|---|---|---|---|
| 02 §3.14, ligne `landing.pricing.overline` · `.title` · `.lead` (colonne « Rôle ») | « commission uniquement à la signature » reprend la tournure écartée par #9 (moment du paiement, D20) ; un futur rédacteur pourrait la réintroduire. | En-tête standard : transparence, commission seulement sur contrat signé | Sans objet (description interne) |
| 02 §3.16, ligne 1 `signupCost` (colonne « Contenu attendu ») | « INFLUX n'est rémunéré qu'à la signature » : même remarque que ci-dessus. | Inscription gratuite pour les deux publics ; INFLUX n'est rémunéré que sur les contrats signés | Sans objet (description interne) |
| 02 §3.14, ligne `landing.pricing.phone.screenTitle` · `.netLabel` · … (colonne « Rôle ») et schéma desktop du téléphone | L'ordre décrit omet `commissionLine` et `sharesLine` (pourtant placées sous `contractLine` à la ligne suivante), et le schéma affiche « Net créateur reversé » au lieu du libellé de la clé. | Écran du téléphone, dans cet ordre : titre, libellé du net créateur (« Votre net créateur reversé »), 1 300,00 €, `contractLine`, `commissionLine`, `sharesLine`, bouton factice | Sans objet (description interne) |

**Pour `testeur` (étape 6)** : contrôler automatiquement les longueurs à la limite ou proches,
comptées à la main : `landing.pricing.phone.caption` (FR et EN 120 / 120), `landing.pricing.notes.taxes`
(FR 156 / 160), `landing.pricing.phone.sharesLine` (EN 59 / 60), ainsi que l'identité
400,00 + 300,00 + 1 300,00 = 2 000,00 dans le tableau, la vérification, la FAQ `commission` et
l'écran du téléphone, en FR et en EN.
