# La mise en relation courtée — protéger et tracer la rémunération d'INFLUX

> **Date :** 2026-09-18
> **Auteurs :** `expert-paiement-facturation` + `expert-conformite-rgpd`
> **Statut :** **proposition à valider par le fondateur**
> **Skill appliquée :** `intermediation-tracking`
>
> **Document pivot du MVP.** Il contraint les documents de spécification 05 à 17 : aucun d'eux ne
> redéfinit la mise en relation, le pipeline commercial ni les preuves décrites ici. En cas d'écart,
> `CLAUDE.md` prime et ce document est corrigé.
>
> **À lire avec :** `docs/mvp/00-cadrage-mvp-v2.md` (périmètre et lots) et
> `docs/mvp/02-architecture-3-espaces.md` (choix techniques), rédigés en parallèle par
> `chef-de-projet` et `architecte`.
>
> **Public :** le fondateur (relecture métier), un juriste (matière de la clause), un développeur
> (règles à implémenter), et **un nouveau commercial** qui doit pouvoir lire ce document et savoir
> comment traiter une demande, ouvrir une conversation et enregistrer une affaire.

---

## 1. Le problème, posé sans détour

Le MVP arbitré le 2026-09-18 (A1) place **le contrat et le paiement hors de l'application**. Le
commercial envoie le contrat comme il veut — e-mail, DocuSign, main propre — et le paiement se fait
à la confiance. INFLUX n'encaisse rien dans la plateforme.

Il faut dire ce que cela signifie exactement :

> **INFLUX livre ce qui a de la valeur — l'identité d'un créateur, une mise en relation qualifiée,
> une négociation menée — et ne retient plus rien par la technique.**

Dans le modèle cible, la commission était sécurisée par la mécanique : l'annonceur payait dans
l'application, INFLUX retenait ses deux parts, le créateur recevait son net. Ici, entre la mise en
relation et l'encaissement, il n'y a plus qu'une relation commerciale et la parole des gens.

Ce n'est pas un défaut de conception, c'est un choix assumé : l'un des fondateurs exerce déjà ce
métier informellement, en physique, et la plateforme sert d'abord à **le structurer et à le passer à
l'échelle**. Mais ce choix impose de regarder trois illusions en face et de les écarter par écrit.

### Les trois illusions à écarter

**Illusion n° 1 — « on empêchera le contournement ».** Non. Deux personnes majeures qui se sont
parlé peuvent se recontacter, signer ailleurs et payer en espèces. Aucune fonctionnalité ne
l'empêchera. L'objectif réaliste est différent : **le rendre coûteux, visible et socialement
inconfortable**. Coûteux parce qu'il faut renoncer au commercial qui fait le travail ; visible parce
que la mise en relation est datée, nommée et confirmée par e-mail aux deux parties ; inconfortable
parce qu'un commercial présent dans la conversation n'est pas un logiciel qu'on contourne, c'est
quelqu'un qu'on trahit.

**Illusion n° 2 — « on facturera plus tard les mises en relation du pilote ».** Non. On ne facture
pas rétroactivement une mise en relation faite sous des CGU muettes sur le sujet. C'est exactement
pourquoi A5 pose **la clause de non-contournement dès le jour 1**, même si INFLUX annonce qu'il n'en
fera pas usage pendant le pilote : ce qui n'est pas écrit au moment des faits ne sera jamais
récupérable. Le coût d'écrire la clause maintenant est d'une page de CGU ; le coût de ne pas
l'écrire est l'intégralité du revenu du pilote.

**Illusion n° 3 — « la détection de coordonnées protégera le modèle ».** Non. Elle **documente**,
elle ne **prévient** pas. Un numéro de téléphone s'écrit en toutes lettres, se photographie, se dit
en visio ou se donne dans un salon. La détection sert à alerter un humain qui décide, pas à tenir
une frontière.

---

## 2. Ce qui protège réellement, par ordre d'efficacité décroissante

| Rang | Mécanisme | Ce qu'il coûte | Ce qu'il rapporte |
|---|---|---|---|
| **1** | **Le commercial présent et nommé dans la conversation** | Le plafond de croissance : une affaire mobilise un humain | La protection principale. On ne contourne pas discrètement quelqu'un qui lit le fil, connaît les deux parties et rappelle |
| **2** | **Le pipeline commercial** qui rend l'affaire visible | Quelques minutes de saisie par affaire | La seule mesure du revenu réel, et l'outil qui rend l'anomalie repérable |
| **3** | **La preuve d'intermédiation horodatée** (registre chaîné + e-mail aux deux parties) | Quasi nul : une transaction et un e-mail | Le socle de toute réclamation future, et une confirmation professionnelle attendue |
| **4** | **La clause de non-contournement** | Des honoraires de juriste | Un fondement juridique, dissuasif surtout côté annonceur professionnel |
| **5** | **La détection de coordonnées** | Faux positifs, un peu de bruit | Un signal d'alerte parmi d'autres, rien de plus |

**Pourquoi cet ordre, et pas l'inverse.** L'ordre spontané consisterait à mettre la clause juridique
en tête et l'humain en dernier. C'est l'erreur classique des plateformes d'intermédiation. Une
clause ne se déclenche que devant un tribunal, après des mois, pour un montant qui rend rarement
l'action rentable — une commission de 700,00 EUR sur un contrat de 2 000,00 EUR ne justifie pas un
contentieux international. Le commercial, lui, agit tous les jours, sans délai, sans frais, et son
effet est préventif.

**Conséquence de gouvernance :** si le délai dérape, on retire des choses dans l'ordre inverse de ce
tableau. On ne retire **jamais** le commercial dans la conversation, le pipeline, ni
`identity_revealed_at`.

---

## 3. Le processus complet, du déclencheur à la commission encaissée

```
  Marque                    INFLUX (commercial)                   Créateur
    │                              │                                 │
    │ cherche (profils anonymes)   │ cherche en vue identifiée       │ publie son profil
    │ ──── demande de contact ───► │ ◄──── candidature ──────────────│
    │                              │                                 │
    │ ◄──────────── PROPOSITION INFLUX (3e déclencheur) ────────────► │
    │     le commercial rapproche lui-même une marque et un créateur  │
    │     sur une campagne donnée, sans demande préalable d'aucun     │
    │                              │                                 │
    │                    ┌─────────▼──────────┐                      │
    │                    │ FILE DE VALIDATION │  ← le commercial     │
    │                    │ valide · s'attribue│    décide et devient │
    │                    │ · refuse + motif   │    responsable       │
    │                    │ (la proposition    │                      │
    │                    │  INFLUX la court-  │                      │
    │                    │  circuite)         │                      │
    │                    └─────────┬──────────┘                      │
    │                              │                                 │
    │   ┌──────────────────────────▼─────────────────────────────┐   │
    │◄──┤  CONVERSATION À TROIS — identités révélées aux parties │──►│
    │   │  commercial visible et nommé · tout est journalisé     │   │
    │   └──────────────────────────┬─────────────────────────────┘   │
    │                              │                                 │
    │             ┌────────────────▼─────────────────┐               │
    │             │ PIPELINE COMMERCIAL (backoffice) │               │
    │             │ contrat envoyé → signé → payé    │  hors app :   │
    │             │ montant · commission · encaissée │  e-mail /     │
    │             └──────────────────────────────────┘  DocuSign /   │
    │                                                    physique    │
```

### Déroulé étape par étape

| # | Acteur | Action | Trace produite | Délai attendu |
|---|---|---|---|---|
| 1 | Marque, créateur **ou commercial** | Déclenche une mise en relation (§4) | Objet `introduction` créé, référence `MER-2026-000123`, origine et motif enregistrés | Immédiat |
| 2 | Commercial | Prend en charge la demande dans la file (verrou : un seul à la fois) | `in_review`, agent et horodatage | **4 h ouvrées** (recommandé, D39) |
| 3 | Commercial | Valide et s'attribue l'affaire, **ou** refuse avec un motif typé | `approved` + `owner_agent_id`, ou `rejected` + motif | **1 jour ouvré** (recommandé, D39) |
| 4 | Les deux parties | Acceptent à l'écran (pour la proposition INFLUX, voir §4.3) | Acceptation datée + version de CGU, par partie | — |
| 5 | Système | **Révèle les identités**, ouvre la conversation à trois, envoie un e-mail à chaque partie | `identity_revealed_at` (write-once), événement chaîné, 2 e-mails avec `messageId` conservé | Immédiat, dans une seule transaction |
| 6 | Les trois | Négocient dans la conversation, commercial visible et nommé | Messages, lectures d'agents journalisées, signalement de coordonnées | — |
| 7 | Commercial | Envoie le contrat **hors plateforme** et le note | `contract_sent` + date + **mode d'envoi** | — |
| 8 | Commercial | Enregistre la signature, le montant négocié et la commission convenue | `signed` + montant + devise + commission | À la signature |
| 9 | Commercial | Facture la commission hors application, puis enregistre l'encaissement | `commission_invoiced` puis `commission_received` + montant + date | Relance à J+7 et J+30 |
| 10 | INFLUX | Rapproche les encaissements du relevé bancaire, par devise | Écarts en alerte | Mensuel |

Aucune étape n'est facultative. Une mise en relation sans étape 5 n'a pas de preuve ; une affaire
sans étapes 8 et 9 n'existe pas dans les comptes d'INFLUX.

---

## 4. Les trois déclencheurs

### 4.1 Demande de contact (la marque demande)

La marque a repéré un profil **anonymisé** et veut rencontrer le créateur. Elle rattache une
campagne si elle en a une, écrit un motif court et accepte à l'écran. **Rien n'est révélé.** La
demande entre dans la file.

### 4.2 Candidature (le créateur postule)

Le créateur répond à une campagne publiée. Contenu de candidature, plafond de candidatures actives
(pour éviter l'arrosage), acceptation à l'écran. La candidature entre dans la file.

### 4.3 Proposition INFLUX (le commercial rapproche)

**C'est le geste métier qui existe déjà hors plateforme, et le plus important des trois.** Le
commercial part d'une campagne, ouvre la recherche de créateurs **en vue identifiée**, sélectionne
un ou plusieurs créateurs, écrit son motif, et ouvre autant de mises en relation.

| Règle | Détail |
|---|---|
| Vitesse | **Trois clics.** Si c'est plus lent qu'un coup de fil, le commercial reprendra son téléphone et la trace n'existera pas. |
| Motif écrit | **Obligatoire.** C'est ce qui distingue un rapprochement réfléchi d'un envoi de masse. |
| Un objet par créateur | Une sélection de cinq créateurs crée **cinq `introduction` distinctes**, cinq références, cinq suivis. Aucun objet « lot ». |
| File de validation | **Court-circuitée** : le commercial est déjà le décideur, il s'attribue l'affaire d'office. |
| Conversation et preuves | **Identiques aux deux autres déclencheurs.** Même objet, même révélation horodatée, même conversation à trois, mêmes e-mails. |

#### Le consentement n'est pas court-circuité

> **La proposition INFLUX court-circuite la file de validation, mais elle ne court-circuite pas le
> consentement des parties.**

Ni la marque ni le créateur n'ont rien demandé. On ne peut donc leur opposer une acceptation qu'ils
n'ont pas donnée, ni révéler l'identité de l'un à l'autre sans leur accord. Mécanisme recommandé :

| Moment | Ce qui existe en base | Ce que voient les parties |
|---|---|---|
| Le commercial crée la proposition | `introduction` en `approved`, commercial responsable, motif enregistré. **`identity_revealed_at` est vide.** | Rien n'est révélé |
| Chaque partie reçoit une invitation | — | La campagne, le format, le motif du commercial — **sans identifier l'autre partie** (le créateur reste anonymisé, la marque est présentée sans coordonnées directes) |
| Une partie accepte à l'écran | `advertiser_accepted_at` **ou** `creator_accepted_at`, avec la version de CGU | Toujours rien : on attend l'autre |
| **Les deux ont accepté** | `identity_revealed_at` posé, événement chaîné écrit, conversation ouverte, deux e-mails envoyés | **Les identités sont révélées à cet instant, simultanément** |
| Une partie refuse ou ne répond pas | `rejected` (motif `declined_by_party`) ou `expired` | Rien n'a été révélé, **rien n'est dû** |

Ce mécanisme a une conséquence qui va dans le bon sens : **la créance éventuelle de la V2 naît de la
révélation, pas de l'initiative du commercial.** INFLUX n'a livré de valeur qu'au moment où les deux
parties se sont vues. C'est défendable devant un client comme devant un juge.

**À faire valider par un juriste** : le contenu exact de l'écran d'acceptation, et la confirmation
que l'acceptation générale des CGU à l'inscription ne suffit pas à couvrir une mise en relation non
sollicitée.

---

## 5. Les mécanismes M1 à M7, recalibrés

Le tableau du plan validé, puis ce que chacun devient concrètement.

| # | Mécanisme | Rôle dans ce MVP |
|---|---|---|
| **M1** | Objet `introduction` | **Maintenu intégralement** — objet pivot du produit |
| **M2** | Preuve d'intermédiation | **Maintenu** : registre chaîné + e-mail aux deux parties |
| **M3** | Clause de non-contournement | Préparée par les agents, **rédigée et validée par un juriste**, asymétrique |
| **M4** | Journal d'audit | Append-only **réel**, lectures d'agents comprises |
| **M5** | Détection de coordonnées | **Allégée : signaler, pas masquer** |
| **M6** | Indicateur de contournement | **Fortement allégé** : deux alertes simples, pas de score |
| **M7** | Suite donnée par les utilisateurs | **Remplacé par A8** — le commercial saisit lui-même l'issue |

### M1 — L'objet `introduction`

La mise en relation est une **entité de première classe**, pas un état d'une conversation. Elle
porte : l'origine (les trois déclencheurs) et le motif, le commercial responsable, **les pays des
deux parties historisés à la date de la mise en relation**, `identity_revealed_at`, la version de
CGU acceptée par chaque partie, le statut, l'état commercial.

Deux points méritent d'être défendus :

- **Les pays sont copiés, pas joints.** Un créateur qui déménage du Canada vers la France ne doit
  pas réécrire l'histoire d'une mise en relation faite quand il était au Canada : le droit
  applicable, la fiscalité et la recevabilité de la clause se lisent au jour des faits.
- **`identity_revealed_at` s'écrit une seule fois.** Une date de révélation modifiable ne prouve
  rien du tout. C'est une contrainte de base, pas une convention de code.

### M2 — La preuve d'intermédiation

Deux pièces complémentaires, dont une seule a de la valeur externe.

**Le registre chaîné** (interne) : chaque événement écrit une ligne qu'on ne peut ni modifier ni
supprimer, chaînée à la précédente par une empreinte. Voir M4.

**L'e-mail transactionnel aux deux parties** (externe) : à la révélation, chaque partie reçoit un
e-mail portant la référence `MER-2026-000123`, la date et l'heure, le nom des deux parties, **le nom
du commercial INFLUX qui suit l'affaire**, la campagne et la version de CGU applicable.

> **C'est la preuve la plus forte et la moins chère du dispositif.** Elle sort du système d'INFLUX :
> une copie est conservée par le prestataire d'envoi, par les serveurs de messagerie des deux
> parties, souvent par les parties elles-mêmes. Elle est horodatée dans ses en-têtes, hors de toute
> base que nous administrons. Elle a été reçue par les deux parties **au moment des faits**, qui
> pouvaient la contredire sur le champ — un destinataire qui n'a rien contesté le jour même aura du
> mal à nier la mise en relation dix-huit mois plus tard. Et elle coûte une fraction de centime.

Elle est de toute façon attendue : c'est la confirmation professionnelle normale d'une mise en
relation. **Aucun raccourci sur cet e-mail** ; un échec d'envoi est rejoué, et un échec définitif est
une alerte backoffice.

### M3 — La clause de non-contournement

Voir §7. Elle existe dès le jour 1, elle est asymétrique, et elle n'apparaît **jamais** comme une
menace dans l'interface.

### M4 — Le journal d'audit

Append-only **réel**, pas par convention :

1. `REVOKE UPDATE, DELETE` sur la table pour tous les rôles applicatifs, y compris le rôle de
   service. Seul l'`INSERT` est accordé.
2. Un **trigger** `BEFORE UPDATE OR DELETE` qui lève une exception. Le `REVOKE` protège du code, le
   trigger protège d'une future migration distraite qui redonnerait un droit.
3. **Chaînage par hachage** : empreinte du contenu, empreinte de la ligne précédente, séquence
   monotone. Retirer ou modifier une ligne casse toutes les suivantes.
4. **Vérification périodique** de la chaîne, avec alerte sur rupture ou trou de séquence. Une chaîne
   jamais vérifiée n'est pas une chaîne.
5. Journalise en plus **chaque lecture d'une conversation par un agent non participant** (A10).
6. **Aucune purge** : conservation probatoire au-delà d'une suppression de compte, **à inscrire dans
   la politique de confidentialité dès le Lot 1**. C'est une obligation d'information, pas un détail.

**L'honnêteté nécessaire :** c'est une preuve **auto-produite**. Elle est produite, hébergée et
administrée par la partie intéressée. Sa force vient de sa **cohérence** avec des éléments détenus
par des tiers — l'e-mail et ses en-têtes, les journaux du prestataire d'envoi, les traces de
connexion — pas de son autorité propre. En conséquence : **ne jamais écrire « horodatage certifié »,
« valeur probante » ou « preuve légale »** dans l'interface, les CGU ou un e-mail. Les termes justes
sont « journal d'activité », « historique de la mise en relation », « confirmation envoyée le … ».
L'horodatage qualifié par un tiers est une option V2, à ouvrir si un contentieux réel le justifie.

### M5 — La détection de coordonnées, allégée

**On signale au commercial, on ne masque pas, on ne bloque pas.** Il est déjà dans le fil et voit
tout en temps réel ; masquer automatiquement gênerait un échange légitime qu'il supervise déjà, et
transformerait chaque faux positif en incident.

- Motifs détectés : e-mail, téléphone (**formats internationaux**), identifiant social, lien de
  messagerie tierce, IBAN.
- Effet : un signalement visible par le commercial sur le fil, et une entrée dans la liste d'alertes.
- Ce qui n'arrive pas : aucun masquage, aucun blocage d'envoi, **aucune sanction automatique**.
- Faux positifs assumés : un nom de domaine dans un brief n'est pas une tentative de contournement.
- **Pièces jointes interdites** dans la messagerie : vecteur de contournement, surface de sécurité et
  charge de modération hors de portée au MVP.
- On stocke le **type** de motif et sa position, pas une copie du message.

Politique exacte et formulation : **D30**.

### M6 — L'indicateur de contournement, fortement allégé

Pas de calcul nocturne pondéré au MVP. Le commercial connaît ses affaires. Deux alertes suffisent :

1. **coordonnées repérées** dans un fil ;
2. **fil silencieux depuis 14 jours sans état commercial mis à jour**.

Le score pondéré est reporté. Il n'apporterait rien tant que le volume se compte en dizaines
d'affaires, et il donnerait une fausse impression de contrôle.

### M7 — Remplacé par A8, et c'est un net progrès

Le dispositif initial demandait **aux utilisateurs** de déclarer la suite donnée à une mise en
relation. Il est remplacé : **le commercial saisit lui-même l'issue** dans le pipeline.

| | M7 (déclaration par l'utilisateur) | **A8 (saisie par le commercial)** |
|---|---|---|
| Taux de réponse | 30 à 50 % au mieux | **Proche de 100 %** : c'est le travail du commercial |
| Biais | Fort : ceux qui contournent sont précisément ceux qui ne répondent pas | Faible : le commercial est intéressé à déclarer l'affaire qu'il a faite |
| Friction utilisateur | Réelle : relances, e-mails, formulaires | **Nulle** : l'utilisateur ne voit rien |
| Fiabilité du montant | Déclaratif, arrondi, souvent faux | Le montant négocié, connu du commercial |
| Ce qu'on y gagne | — | Une donnée de revenu exploitable **et** un outil de pilotage commercial |

C'est un cas rare où supprimer une fonctionnalité améliore la donnée. Le point de vigilance est
ailleurs : **la qualité de la donnée dépend entièrement du sérieux de la saisie.** C'est une
discipline d'équipe, pas un contrôle technique — à traiter comme telle (§10, limites assumées).

---

## 6. Le pipeline commercial

C'est la **seule chose qui dise à INFLUX combien il gagne, sur quoi et avec qui**. Il vit dans le
backoffice (Lot 5) et il est alimenté par le commercial responsable.

### 6.1 Les états de l'affaire

```
  open ──► negotiating ──► contract_sent ──► signed ──► commission_invoiced ──► commission_received
    │           │                │             │                │
    └───────────┴────────────────┴─────────────┴────────────────┴──►  lost (motif typé)
                │                │             │
                └────────────────┴─────────────┴──────────────────►  stalled  ·  disputed
```

| État | Ce qu'il signifie | Ce qui devient obligatoire à la saisie |
|---|---|---|
| `open` | Conversation ouverte, rien de convenu | — |
| `negotiating` | Un montant est discuté | Montant négocié + devise |
| `contract_sent` | Contrat envoyé **hors plateforme** | Date d'envoi + **mode d'envoi** (e-mail, DocuSign, main propre, autre) |
| `signed` | Contrat signé entre les parties | Date de signature, montant, devise, **commission convenue** |
| `commission_invoiced` | INFLUX a facturé sa commission | Date + référence de facture externe |
| `commission_received` | Commission encaissée, en tout ou partie | Montant encaissé + date |
| `lost` | L'affaire ne se fera pas | **Motif typé** |
| `stalled` | Sans nouvelle depuis 14 jours | Alerte automatique, pas un état subi |
| `disputed` | Litige entre les parties, ou sur la commission | Commentaire interne obligatoire |

Règles de transition : on n'entre en `signed` que depuis `contract_sent` ou `negotiating` ; on
n'entre en `commission_received` que depuis `commission_invoiced` ; `lost` est accessible depuis
tout état non terminal, avec motif. **Toute transition est journalisée** avec son auteur et sa date.

**Une affaire est toujours rattachée à une `introduction`.** Pas de `deal` orphelin : une affaire
sans mise en relation est une affaire qu'INFLUX n'a pas produite, et elle n'a rien à faire dans le
pipeline.

### 6.2 Les champs, et qui les saisit

| Champ | Qui | Quand | Contrôle serveur |
|---|---|---|---|
| `negotiated_amount` | Commercial | Dès `negotiating` | > 0, entier en plus petite unité monétaire ou `numeric` exact — **jamais un flottant** |
| `currency` | Commercial | Avec le montant | ISO 4217, liste fermée, **immuable une fois `signed`** |
| `agreed_commission_amount` | Commercial | À `signed` | > 0 et **≤ `negotiated_amount`** |
| `agreed_commission_note` | Commercial | À `signed` | Texte libre (« barème standard 35 % », « dérogation partenariat ») — **jamais un taux exploité par le code** |
| `contract_sent_at` + `contract_sent_channel` | Commercial | À `contract_sent` | Canal dans une liste fermée |
| `signed_at` | Commercial | À `signed` | Postérieur à `identity_revealed_at` |
| `commission_invoice_ref` + date | Commercial ou administration | À `commission_invoiced` | — |
| `commission_received_amount` + date | Commercial ou administration | À `commission_received` | ≤ `agreed_commission_amount`, sinon justification obligatoire |
| `lost_reason_code` | Commercial | À `lost` | Liste fermée |
| `owner_agent_id` | Système | À la validation | Repris de l'`introduction`, réattribuable avec trace |

**Toute modification d'un montant ou d'une date est historisée** : qui, quand, ancienne valeur,
nouvelle valeur. C'est la matière de la facturation V2 et d'un éventuel contentieux ; un montant
écrasé sans trace est un montant perdu.

### 6.3 L'exemple de référence, en régime MVP

| Élément | Valeur | Qui la produit |
|---|---|---|
| Montant du contrat (coût total pour l'annonceur) | **2 000,00 EUR** | **Saisi** par le commercial |
| Part annonceur INFLUX (20 %) | 400,00 EUR | Barème commercial, **hors application** |
| Part créateur INFLUX (15 %) | 300,00 EUR | Barème commercial, **hors application** |
| Commission INFLUX totale (35 %) | **700,00 EUR** | **Saisie** par le commercial |
| Net créateur | **1 300,00 EUR** | Affiché par simple soustraction 2 000,00 − 700,00 |
| Vérification | 400,00 + 300,00 + 1 300,00 = 2 000,00 EUR ✅ | Faite par un humain |

L'application a enregistré 2 000,00 et 700,00, affiché 1 300,00, vérifié que 700,00 est strictement
positif et inférieur à 2 000,00. **Elle n'a appliqué aucun taux.**

### 6.4 Rapprochement, relances et exports

- Rapprochement mensuel de `commission_received_amount` avec le relevé bancaire, **par devise**.
  Tout écart est une alerte, jamais une correction silencieuse.
- Relances automatiques au commercial : `signed` sans commission facturée à **J+7** ;
  `commission_invoiced` sans encaissement à **J+30** ; `stalled` à **14 jours**.
- Export comptable par devise, chaque ligne portant la référence `MER-…` de la mise en relation
  d'origine — c'est ce qui rattache un euro encaissé à un acte d'intermédiation traçable.

---

## 7. La règle absolue : aucun calcul de commission

> ## **AUCUN TAUX ET AUCUN CALCUL DE COMMISSION DANS LE CODE AU MVP.**
>
> **La seule arithmétique autorisée est l'addition et la soustraction de montants saisis. Aucune
> multiplication par un taux, nulle part — ni serveur, ni front, ni export, ni e-mail.**
>
> La table `commission_rates` est **créée et reste vide**.

Pourquoi c'est une règle et non une préférence : `CLAUDE.md` §2 impose que le calcul de la commission
n'existe **qu'à un seul endroit** dans tout le code. Un moteur écrit à moitié maintenant — un `0,35`
dans un composant, un `× 0,20` dans un export — créerait exactement la duplication que l'invariant
interdit, sans être utilisable pour autant. **Pire que rien.**

Créer la table vide n'est pas une anticipation, c'est un **garde-fou** : elle force le développeur de
la V2 à lire les taux en base plutôt qu'à écrire `0.35` en dur, et, vide, elle rend tout calcul
impossible au MVP.

Le taux de 35 % et sa répartition 20 % / 15 % restent l'invariant de `CLAUDE.md` §2 et relèvent du
fondateur seul. Ce document ne les discute pas : il décrit comment INFLUX les applique
**commercialement**, hors de l'application, pendant la durée du pilote.

---

## 8. La matière de la clause de non-contournement, pour le juriste

> **Je ne suis pas avocat.** Ce qui suit est une **checklist de matière première**, pas une
> rédaction juridique. Un professionnel du droit rédige, adapte par pays et valide avant toute mise
> en ligne. `expert-conformite-rgpd` conserve son veto.

### 8.1 Ce que la clause doit couvrir

- [ ] **Définition de la mise en relation** : identifiée par sa référence (`MER-2026-000123`), sa
      date de révélation d'identité et l'identité des deux parties.
- [ ] **Fait générateur** : toute collaboration rémunérée conclue entre les deux parties et **issue
      de** cette mise en relation.
- [ ] **Assiette et barème** : renvoi au barème en vigueur (35 %, part annonceur 20 %, part créateur
      15 %) **et non un taux figé dans le corps des CGU** — sinon toute évolution du barème imposera
      une nouvelle acceptation de tous les utilisateurs.
- [ ] **Durée de la fenêtre** de non-contournement — **D29**.
- [ ] **Obligation de déclarer** toute collaboration issue d'une mise en relation, dans un délai
      défini.
- [ ] **Justificatifs raisonnables** côté annonceur professionnel, proportionnés et limités à l'objet.
- [ ] **Clause de sauvegarde « relation préexistante »** : la partie qui prouve un contact antérieur
      à la mise en relation échappe à la clause. **Indispensable** : sans elle, la clause est
      déloyale, et sa déloyauté fragilise l'ensemble du document.
- [ ] **Moratoire du pilote** (§8.3).
- [ ] **Langue, droit applicable et juridiction** — dépend de D25 (pays de la société).

### 8.2 Rédaction asymétrique — obligatoire

| Partie | Régime recommandé | Pourquoi |
|---|---|---|
| **Annonceur (professionnel, B2B)** | **Ferme** : obligation de déclaration, indemnité forfaitaire envisageable, droit à justificatifs | Rapport entre professionnels, clause pénale usuelle et généralement admise |
| **Créateur particulier (B2C)** | **Loyauté et obligation de déclaration, sans clause pénale** ; au plus une résiliation du compte | Une clause pénale à sens unique imposée à un consommateur **risque la nullité pour clause abusive** (droit de la consommation de l'UE et équivalents dans les autres zones visées). Une clause annulée ne protège personne, et son annulation contamine la crédibilité du reste des CGU. |

**Dans l'interface, jamais une menace.** Le ton est celui d'un partenaire : « dites-nous ce que cette
mise en relation a donné ». La clause vit dans les CGU ; elle n'a rien à faire dans un bandeau
d'avertissement, un e-mail de relance ou un écran de conversation. Une plateforme qui menace ses
utilisateurs perd les deux côtés de son marché avant d'avoir encaissé quoi que ce soit.

### 8.3 Le moratoire du pilote — le point le plus sérieux du document

A5 pose la clause dès le jour 1 mais prévoit qu'INFLUX **annonce publiquement** ne pas en faire usage
pendant le pilote.

> **Une annonce publique de non-usage peut s'analyser en renonciation au droit.** Après plusieurs
> mois de « nous ne l'appliquons pas », l'invoquer devient difficile, et une partie pourra soutenir
> qu'elle a contracté sur la foi de cette annonce. Le risque n'est pas théorique : c'est le
> mécanisme classique par lequel une tolérance répétée devient opposable à celui qui l'a consentie.

Rédaction qui limite le risque, à faire valider par le juriste :

| Ce qu'il faut éviter | Ce qu'il faut préférer |
|---|---|
| « INFLUX ne facturera pas de commission pendant le pilote » | Un **moratoire daté** : « jusqu'au JJ/MM/AAAA » |
| Un engagement indéfini | Un moratoire **révocable avec préavis**, applicable aux seules mises en relation postérieures à la révocation |
| Une renonciation générale | Un moratoire **conditionné à la déclaration de l'affaire** : INFLUX renonce à réclamer sa commission sur les affaires qui lui sont déclarées, pas sur celles qui lui sont dissimulées |
| Le vocabulaire de la renonciation (« renonce à », « abandonne ») | Le vocabulaire de la **tolérance commerciale** (« n'exercera pas, jusqu'au …, sous réserve de … ») |

**C'est au juriste de trancher.** Aucun agent ne rédige ce paragraphe seul, et sa formulation
définitive conditionne la valeur de toute la protection décrite dans ce document.

---

## 9. Les données à créer en base dès maintenant

Chaque ligne répond à la même question : *pourquoi maintenant et pas plus tard ?*

| Table / colonne | Domaine | Pourquoi maintenant |
|---|---|---|
| `terms_versions` + `terms_acceptances` | `identity` | Une clause qu'on n'a pas fait accepter **à la date de la mise en relation** n'est opposable à personne. Reconstituer a posteriori qui avait accepté quelle version est impossible. |
| `introductions.reference` (`MER-2026-000123`) | `matching` | Une preuve qu'on ne sait pas nommer ne sert à rien. Citée dans les e-mails, les fils et la future facture. |
| `introductions.origin` + `origin_reason` | `matching` | Prouve l'initiative d'INFLUX, en particulier pour la proposition INFLUX où aucune partie n'a rien demandé. |
| `introductions.identity_revealed_at` | `matching` | Date de naissance de la créance V2 et point de départ de la fenêtre D29. **Non reconstituable.** |
| `introductions.advertiser_country_at_intro` / `creator_country_at_intro` | `matching` | Droit applicable, fiscalité et validité de la clause se lisent **au jour des faits**. L'utilisateur déménage, la preuve non. |
| `introductions.owner_agent_id` | `matching` | Intéressement commercial, futur portefeuille, et mesure du plafond de croissance. Savoir six mois plus tard qui a fait quoi est impossible sans cette colonne. |
| `introduction_events` (chaîné, append-only) | `backoffice` | Une chaîne de preuve qui commence après les faits ne prouve rien : elle doit démarrer au premier événement. |
| `conversations` / `conversation_participants` / `messages` / `message_reads` | `messaging` | Le commercial est un participant de première classe ; les lectures par un agent doivent être journalisées (A10). |
| `contact_detections` | `messaging` | Signal de contournement et corpus qui servira à régler la détection. |
| **`deals`** (montant, devise, commission convenue, commission encaissée, dates, canal, motif de perte, commercial) | `billing` | Seule mesure du revenu réel, **et seule assiette disponible** si la commission devient exigible en V2. |
| `commission_rates` — **créée et vide** | `billing` | Garde-fou : force la lecture des taux en base en V2, rend tout calcul impossible au MVP. |
| `messageId` des e-mails transactionnels | `leads` | Le lien entre le registre interne et la preuve détenue par des tiers. Sans lui, on ne sait pas retrouver l'e-mail chez le prestataire. |

La modélisation détaillée (types, contraintes, index, RLS) relève de `expert-database` et du document
`04-modele-de-donnees-mvp.md`, dans le respect de la skill `supabase-schema` : montants en entiers ou
`numeric` exact, **jamais de flottant**, devise ISO 4217 explicite, horodatages `timestamptz`,
pas de suppression physique des données financières.

---

## 10. Les limites assumées par écrit

Ce dispositif **ne protège pas** contre :

1. **Une collaboration nouée après la mise en relation et payée hors de toute trace.** Deux majeurs
   qui décident de s'entendre en dehors d'INFLUX y parviendront. Le dispositif rend le geste visible
   et inconfortable ; il ne l'empêche pas.
2. **Un recontact différé.** Un annonceur qui rappelle un créateur douze ou vingt-quatre mois plus
   tard sortira, selon la durée retenue, de la fenêtre de non-contournement (D29).
3. **Une identité donnée spontanément dans le fil.** Un créateur qui écrit son vrai nom ou son
   compte dans un message annule l'anonymisation. Le commercial le voit, mais après coup.
4. **L'absence de tout moyen de contraindre au paiement.** INFLUX n'encaisse rien : si la commission
   n'est pas payée, le seul recours est commercial, puis juridique — et une commission de 700,00 EUR
   sur un contrat de 2 000,00 EUR ne justifiera jamais un contentieux international. **Le
   recouvrement repose sur la relation, pas sur le droit.**
5. **La fragilité d'une preuve auto-produite.** Le registre chaîné vaut par sa cohérence avec les
   e-mails détenus par des tiers, pas par lui-même. Sans e-mail confirmé, il est peu convaincant.
6. **Une saisie négligée.** Tout le pilotage du revenu repose sur ce que le commercial saisit dans le
   pipeline. Un commercial qui ne saisit pas rend INFLUX aveugle sur son propre chiffre d'affaires.
   C'est une **discipline d'équipe**, à traiter comme telle : procédure écrite, revue hebdomadaire du
   pipeline, et intéressement aligné sur la commission **encaissée**, pas sur les mises en relation
   ouvertes.
7. **Le plafond humain.** Chaque conversation mobilise un commercial. La plateforme le rend plus
   rapide, elle ne le remplace pas. L'indicateur « affaires traitées par commercial et par semaine »
   est celui qui dira si le passage à l'échelle fonctionne.

---

## 11. Indicateurs

| Indicateur | Pourquoi | Ce qu'il déclenche s'il dérive |
|---|---|---|
| **Commission encaissée** (par devise, par mois, par commercial) | **L'indicateur principal** : c'est le revenu réel d'INFLUX | Revue du barème et du pilote |
| **Affaires traitées par commercial et par semaine** | Le plafond de croissance est humain | Recrutement, ou simplification du parcours commercial |
| Taux de transformation par déclencheur (`approved` → `signed`) | Dit lequel des trois déclencheurs produit du revenu | Réallocation de l'effort commercial |
| Délai de la file : prise en charge, décision (p50 / p90), % hors SLA | Premier risque produit (D39) | Escalade, renfort, révision du SLA |
| Écart commission convenue / encaissée | Taux de recouvrement réel | Relances, révision des conditions de règlement |
| Mises en relation révélées sans état commercial mis à jour à 30 jours | Signal de contournement **ou** de saisie négligée | Appel du commercial — jamais une accusation automatique |

---

## 12. Décisions ouvertes

| # | Sujet | Arbitre | Échéance |
|---|---|---|---|
| **D29** | **Durée de la fenêtre de non-contournement** et régime asymétrique B2B / B2C. Recommandation à instruire avec le juriste ; plus la fenêtre est longue, plus elle est contestable côté consommateur. | **Fondateur** + juriste | **Lot 1** (la clause part avec les CGU de la première mise en ligne) |
| **D30** | Politique de signalement des coordonnées (formulation, seuils, visibilité) ; pièces jointes interdites confirmées | `product-owner` + `expert-ux` + Fondateur | Lot 4 |
| **D32** | Portée rétroactive de la commission V2 — **tranchée par A5** : clause posée dès le jour 1, usage suspendu pendant le pilote. **Reste à sécuriser la rédaction du moratoire** (§8.3) pour qu'il ne vaille pas renonciation. | Fondateur (tranché) + **juriste** (rédaction) | Lot 1 |
| **D33** | Apollo et créateurs particuliers — **orientation fondateur (A7) : tous les inscrits**. `expert-conformite-rgpd` instruit, **veto maintenu**, validation d'un juriste **obligatoire avant la mise en ligne du Lot 1**. Sans lien direct avec ce document, mais même échéance et même juriste. | `expert-conformite-rgpd` + Fondateur + juriste | Lot 1 |
| **D39** | **SLA de la file de validation** : délai maximal, horaires et jours couverts, ce qui se passe au-delà. **Recommandation : prise en charge sous 4 h ouvrées, décision sous 1 jour ouvré, escalade administrateur à J+1, information systématique de l'initiateur.** | **Fondateur** + `product-owner` | Lot 4, à instrumenter dès l'ouverture |
| **D7 + D23** | **Traitement fiscal de la commission et structure de la facture.** Le plan les reportait en V2 avec le module de paiement. **Ce report n'est plus tenable** : si le commercial encaisse une commission dès le pilote, INFLUX émet une vraie facture dès le premier euro, avec un régime de TVA / GST / sales tax qui dépend du pays de la société (**D25**) et de celui du client. Une facture mal qualifiée se régularise ensuite, mal et à ses frais. | **Fondateur** + **expert-comptable** du pays de la société | **Avant la première commission encaissée**, donc dès le pilote |
| Rappel | D25 (pays de la société) conditionne D7, D23 et la mise en ligne du Lot 1 (mentions légales, CGU). D9, D19, D20, D22, D26, D27 restent reportées avec le module de paiement en V2. | Fondateur + avocat fiscaliste | D25 : avant la semaine 5 |

---

## 13. Ce qui change en V2

Rien de ce qui est construit maintenant n'est à jeter :

- Le **contrat et le paiement entrent dans l'application** (D8, D9). L'`introduction` reste l'objet
  pivot ; le contrat s'y rattache.
- **`commission_rates` se remplit** et le calcul apparaît, **à un seul endroit, côté serveur**,
  conformément à `CLAUDE.md` §2 et à la skill `contract-commission`. Les deux taux sont figés et
  historisés à la signature.
- `deals` devient l'historique commercial du pilote et **la référence pour régler le barème**.
- La clause de non-contournement, acceptée dès le jour 1, **devient exploitable** — c'est tout
  l'intérêt de l'avoir posée maintenant.
- Le registre chaîné **continue sans rupture**, ce qui donne une continuité de preuve du premier
  jour du pilote à la première facture automatique.

---

**Ce document ne modifie aucun autre fichier.** Les mises à jour de `CLAUDE.md` (§2 régime
transitoire, `decisions.md` D29-D39) relèvent de `chef-de-projet`.
