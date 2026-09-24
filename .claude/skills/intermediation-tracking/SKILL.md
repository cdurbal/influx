---
name: intermediation-tracking
description: Tracer une mise en relation courtée INFLUX, de son origine à la commission encaissée — les trois déclencheurs dont la proposition initiée par le commercial, la file de validation, l'attribution, la révélation d'identité horodatée, le registre d'audit, le pipeline d'affaire et les données à conserver pour la V2. À utiliser pour toute fonctionnalité touchant une mise en relation, une négociation ou une affaire.
---

# Tracer une mise en relation courtée

Au MVP, le contrat part **hors plateforme** (e-mail, DocuSign, main propre) et le paiement se fait
**à la confiance** (arbitrage A1 du 2026-09-18). INFLUX n'encaisse rien dans l'application.

> **Ce que la plateforme retient n'est donc plus la signature : c'est la trace et l'homme.**
> La meilleure protection contre le contournement n'est pas une clause juridique, c'est un
> commercial présent, visible et nommé dans la conversation. Le dispositif de preuve reste utile,
> mais il vient en second.

Cette skill décrit comment tracer une mise en relation de son origine jusqu'à la commission
réellement encaissée, sans jamais calculer cette commission.

Agents concernés : `expert-paiement-facturation` (principal), `product-owner`,
`expert-conformite-rgpd`, `expert-database`, `expert-cybersecurite`.

Document de référence : `docs/mvp/01-intermediation-courtee.md`.

---

## Étape 1 — Qualifier le déclencheur

Trois déclencheurs, et trois seulement. Aucun d'eux n'ouvre une conversation : ils créent un objet
`introduction`. La conversation n'existe qu'après décision d'un commercial.

| Déclencheur | Qui initie | Ce qui est exigé | Passe par la file | Qui devient responsable |
|---|---|---|---|---|
| **Demande de contact** | Une marque, depuis un profil créateur **anonymisé** | Campagne rattachée si elle existe, motif court obligatoire, acceptation à l'écran | **Oui** | Le commercial qui valide |
| **Candidature** | Un créateur, depuis une campagne publiée | Campagne obligatoire, contenu de candidature, plafond de candidatures actives, acceptation à l'écran | **Oui** | Le commercial qui valide |
| **Proposition INFLUX** | **Le commercial lui-même**, sans demande préalable d'aucune des deux parties | Campagne obligatoire, un ou plusieurs créateurs sélectionnés dans la recherche en vue identifiée, **motif écrit obligatoire** | **Non — court-circuitée** | L'auteur de la proposition, d'office |

### Règles de qualification

1. **Une `introduction` = une marque + un créateur.** Une proposition INFLUX portant sur cinq
   créateurs crée **cinq `introduction` distinctes**, tracées séparément, avec cinq références. Il
   n'existe aucun objet « lot » : un envoi groupé qui produirait un seul objet rendrait la preuve
   d'intermédiation inexploitable créateur par créateur.
2. **Le motif écrit est obligatoire pour la proposition INFLUX.** C'est le geste métier qui la
   justifie, et c'est la seule chose qui distingue un rapprochement réfléchi d'un envoi de masse.
3. **Le déclencheur est immuable.** `origin` ne se modifie jamais après création : c'est lui qui
   qualifie l'antériorité et l'initiative d'INFLUX.
4. **Doublon** : une `introduction` active (non refusée, non expirée) pour le même couple
   marque / créateur sur la même campagne bloque la création d'une seconde. Le déclencheur est
   rattaché à l'existante.
5. La proposition INFLUX doit être **au moins aussi rapide qu'un coup de fil** : trois clics depuis
   la recherche identifiée. Si elle est plus lente, le commercial reprendra son téléphone et la
   trace n'existera pas.

---

## Étape 2 — L'objet `introduction`

C'est l'objet pivot du produit. Tout le reste s'y rattache.

### Cycle de vie

```
   [demande de contact]  ──┐
   [candidature]        ──┤──►  pending_review ──► in_review ──►  approved (non révélée)
                          │           │               │              │
   [proposition INFLUX] ──┴───────────┴───────────────┴──────────────┤
        (entre directement en approved, file court-circuitée)        │
                                      │                    acceptation des deux parties
                              rejected (motif typé)                  │
                              withdrawn (retrait de          approved RÉVÉLÉE : révélation
                                l'initiateur)                d'identité, conversation à trois,
                              expired (cause objective,      e-mails aux 2 parties
                                jamais le seul délai)
```

Transitions autorisées, et rien d'autre (alignées le 2026-09-24 sur
`docs/mvp/13-file-de-validation-et-mise-en-relation.md` RG102, D45 et D49) :

| Depuis | Vers | Qui | Condition |
|---|---|---|---|
| — | `pending_review` | Marque ou créateur | Déclencheur 1 ou 2 |
| — | `approved` non révélée | Commercial | Déclencheur 3, `owner_agent_id` = auteur |
| `pending_review` | `in_review` | Commercial | Prise en charge avec verrou |
| `pending_review` / `in_review` | `withdrawn` | L'initiateur | Avant décision |
| `pending_review` / `in_review` | `expired` | Système | **Cause objective seulement** (campagne close, compte suspendu…). **Jamais le seul dépassement du délai** : une entrée hors délai reste en file (D49) |
| `in_review` | `approved` non révélée | Commercial titulaire | — |
| `in_review` | `rejected` | Commercial titulaire | Motif typé obligatoire |
| `approved` non révélée | `approved` **révélée** | Système | **Les deux acceptations existent** (D45) — fonction unique, transaction unique |
| `approved` non révélée | `rejected` (`declined_by_party`) · `withdrawn` · `expired` | Une partie · l'initiateur ou le commercial · le système | Refus à l'écran d'acceptation · retrait avant révélation · silence à J+7 |
| `approved` **révélée** | — | — | **État terminal.** Une mise en relation révélée ne se dé-révèle pas. |

### Champs obligatoires

| Champ | Pourquoi il est obligatoire |
|---|---|
| `reference` — format lisible `MER-2026-000123` | Cité dans les e-mails, les conversations et la future facture. Une preuve qu'on ne sait pas nommer ne sert à rien. |
| `origin` — `brand_contact_request` · `creator_application` · `influx_proposal` | Qualifie l'initiative d'INFLUX. Immuable. |
| `origin_reason` (texte) | Motif du demandeur ; **obligatoire** pour `influx_proposal`. |
| `campaign_id` | Obligatoire pour la candidature et la proposition, facultatif pour la demande de contact. |
| `advertiser_account_id`, `creator_account_id` | Les deux parties. |
| `owner_agent_id` | **Le commercial responsable.** Figé à la décision, réattribuable avec trace. |
| `advertiser_country_at_intro`, `creator_country_at_intro` (ISO 3166-1 alpha-2) | **Historisés à la date de la mise en relation.** Un utilisateur déménage ; le droit applicable, la fiscalité et la recevabilité de la clause se lisent au jour de la mise en relation, pas au jour du litige. Non reconstituable après coup. |
| `advertiser_terms_version_id`, `creator_terms_version_id` | La version de CGU acceptée **par chaque partie**, séparément. Sans elle, la clause de non-contournement n'est opposable à personne. |
| `advertiser_accepted_at`, `creator_accepted_at` | Acceptation **spécifique à l'écran** de cette mise en relation, distincte de l'acceptation des CGU à l'inscription. |
| `identity_revealed_at` (`timestamptz`) | **Write-once.** Date de naissance de la créance V2 et point de départ de la fenêtre de non-contournement. |
| `status`, `rejection_reason_code` | Statut et motif fermé. |
| `deal_state` | L'état commercial, tenu par le commercial (étape 6). |
| `conversation_id` | La conversation à trois, créée à la révélation. |
| `sla_due_at`, `claimed_at`, `decided_at` | Mesure de la file (D39). |
| `created_at`, `updated_at` | Horodatages `timestamptz`, jamais sans fuseau. |

**Règles non négociables :**

- Aucune transition hors du tableau ci-dessus ; toute transition est journalisée (étape 5).
- `identity_revealed_at` s'écrit **une seule fois**, en base, contrainte comprise. Une date de
  révélation modifiable ne prouve rien.
- Les pays et les versions de CGU sont **copiés** sur l'`introduction`, jamais lus par jointure
  vers le compte : le compte change, la preuve ne doit pas changer avec lui.

---

## Étape 3 — La file de validation

Rien ne circule entre deux membres sans l'accord d'un commercial (A9). La file est donc le goulot
d'étranglement du produit **et** son mécanisme de protection.

1. **Entrée.** Les déclencheurs 1 et 2 créent une entrée en `pending_review`, avec `sla_due_at`
   calculé à la création.
2. **Prise en charge, avec verrou anti-double-traitement.** Le passage `pending_review → in_review`
   est une **transition conditionnelle atomique** : la mise à jour ne réussit que si le statut est
   encore `pending_review` (ou sélection `FOR UPDATE SKIP LOCKED`). Le second commercial reçoit un
   message clair (« déjà prise en charge par <nom> »), jamais un écran d'erreur ni un doublon.
   Deux commerciaux qui répondent à la même marque, c'est une perte de crédibilité immédiate.
3. **Attribution.** `owner_agent_id` est figé à la décision. Une réattribution est possible, avec
   auteur, date et motif journalisés — pas une simple mise à jour de colonne.
4. **Refus avec motif typé.** Liste fermée proposée, à valider par `product-owner` :
   `off_topic` · `budget_mismatch` · `creator_unavailable` · `campaign_closed` · `duplicate` ·
   `account_suspended` · `suspected_circumvention` · `country_out_of_scope` · `other`
   (commentaire interne obligatoire si `other`). Un motif libre non typé rend toute statistique de
   refus inexploitable, et c'est cette statistique qui dira ce qui manque au produit.
5. **SLA (D39, tranchée le 2026-09-18).** Le délai de la file est le **premier risque produit** :
   une demande qui attend 48 h tue la conversion et renvoie les parties se chercher ailleurs.
   **Décision sous 1 jour ouvré** ; objectif interne de prise en charge sous 4 heures ouvrées
   (`13` RG17).
6. **Dépassement du SLA.** Trois effets, tous obligatoires :
   - l'initiateur est **informé honnêtement** (« votre demande est toujours en cours de traitement »),
     jamais laissé dans le silence ;
   - une alerte remonte au backoffice et à l'administrateur (escalade recommandée à J+1) ;
   - **aucune expiration au seul écoulement du délai (D49, 2026-09-24).** L'entrée reste en file,
     marquée hors délai, jusqu'à décision. Une demande qui disparaît sans mot est une promesse
     rompue.

---

## Étape 4 — La révélation d'identité

C'est **l'effet de la seconde acceptation des parties, après la validation du commercial** (D45,
2026-09-24) — jamais un bouton « révéler ». C'est aussi la preuve d'intermédiation : l'instant où
INFLUX livre ce qui a de la valeur. Ce qui est révélé : l'**identité** de chaque partie, **jamais
son e-mail ni son téléphone** (D46).

### Ce qui se produit au même instant, dans une seule transaction

1. `identity_revealed_at = now()` — écriture **write-once**.
2. **Écriture d'un événement chaîné** `identity_revealed` dans le registre (étape 5).
3. **Création de la conversation** et de ses **trois participants** : la marque, le créateur, le
   commercial — visible et nommé dès le premier message.
4. **Envoi d'un e-mail transactionnel aux deux parties**, portant :
   la référence `MER-2026-000123`, la date et l'heure avec fuseau, le nom des deux parties, **le nom
   du commercial INFLUX qui suit l'affaire**, la campagne concernée, la version de CGU applicable à
   chacun et un lien vers la conversation.
5. **Conservation du `messageId`** renvoyé par le prestataire d'envoi, rattaché à l'`introduction`.

Si l'envoi de l'e-mail échoue, il est **rejoué** (pipeline `lead-pipeline`) ; l'échec définitif est
une alerte backoffice, jamais un silence. Une mise en relation sans e-mail confirmé est une mise en
relation sans preuve externe.

### Pourquoi l'e-mail est la preuve la plus forte, et la moins chère

Dis-le franchement, c'est un argument de conception :

- **Il sort du système d'INFLUX.** Une copie est conservée par le prestataire d'envoi, par les
  serveurs de messagerie des deux parties et souvent par les parties elles-mêmes. INFLUX ne
  contrôle aucune de ces copies — c'est précisément ce qui leur donne de la valeur.
- **Il est horodaté par des tiers**, dans ses en-têtes, hors de toute base que nous administrons.
- **Il a été reçu par les deux parties au moment des faits**, qui pouvaient le contredire sur le
  champ. Un destinataire qui ne conteste pas une mise en relation le jour où on la lui annonce aura
  du mal à en nier l'existence dix-huit mois plus tard.
- **Il coûte une fraction de centime**, et il est de toute façon attendu : c'est la confirmation
  professionnelle normale d'une mise en relation, pas seulement un dispositif de preuve.

Comparé à tout ce qu'on pourrait construire en interne, c'est le meilleur rapport valeur probante /
coût du MVP. **Aucun raccourci sur cet e-mail.**

### Le consentement, et le cas particulier de la proposition INFLUX

> **La proposition INFLUX court-circuite la file de validation, mais elle ne court-circuite pas le
> consentement des parties.**

Pour les déclencheurs 1 et 2, l'initiateur a accepté à l'écran au moment de sa demande ; l'autre
partie accepte avant de découvrir l'identité.

Pour le déclencheur 3, **aucune des deux parties n'a rien demandé** : on ne peut leur opposer une
acceptation qu'elles n'ont pas donnée, et on ne peut pas non plus leur révéler l'identité de l'autre
sans leur accord. Mécanisme recommandé :

| Moment | Ce qui existe | Ce qui est visible |
|---|---|---|
| Le commercial crée la proposition | L'`introduction` existe, statut `approved`, `owner_agent_id` posé, motif écrit enregistré | Rien n'est révélé. `identity_revealed_at` est **vide**. |
| Chaque partie reçoit une invitation | L'invitation décrit la campagne, le format, le motif du commercial, **sans identifier l'autre partie** | Le créateur reste anonymisé côté marque ; la marque est présentée sans coordonnées directes |
| Une partie accepte à l'écran | `advertiser_accepted_at` ou `creator_accepted_at` est posé, avec la version de CGU | Toujours rien : on attend l'autre |
| **Les deux parties ont accepté** | `identity_revealed_at` est posé, l'événement chaîné est écrit, la conversation à trois s'ouvre, les deux e-mails partent | **Les identités sont révélées à cet instant, simultanément** |
| Une partie refuse ou ne répond pas | `rejected` (motif `declined_by_party`) ou `expired` | Rien n'a été révélé, rien n'est dû |

Conséquence de conception : **`identity_revealed_at` n'est jamais posé à la création d'une
proposition INFLUX.** La créance V2 naît de la révélation, pas de l'initiative du commercial — et
c'est cohérent : INFLUX n'a livré de valeur qu'au moment où les deux parties se sont vues.

**Point à faire valider par un juriste** : le contenu exact de l'acceptation à l'écran et le fait
que l'acceptation des CGU générales à l'inscription ne suffit pas à couvrir une mise en relation
non sollicitée.

---

## Étape 5 — Le registre append-only chaîné

Chaque événement d'une `introduction` est écrit dans un registre qu'on ne peut ni modifier ni
supprimer : création, prise en charge, attribution, refus motivé, acceptation de chaque partie,
révélation d'identité, entrée d'un agent dans la conversation, **lecture d'une conversation par un
agent non participant** (A10), changement d'état de l'affaire, détection de coordonnées.

### Comment on garantit techniquement qu'il n'est pas réécrit

1. **Droits retirés en base** : `REVOKE UPDATE, DELETE` sur la table pour tous les rôles
   applicatifs, y compris le rôle de service. Seul l'`INSERT` est accordé.
2. **Trigger `BEFORE UPDATE OR DELETE`** qui lève une exception. Ceinture et bretelles : le `REVOKE`
   protège du code, le trigger protège d'une future migration distraite qui redonnerait un `GRANT`.
3. **Chaînage par hachage** : chaque ligne porte l'empreinte de son contenu canonique
   (`payload_hash`) et l'empreinte de la ligne précédente (`prev_hash`), plus une **séquence
   monotone**. Modifier ou retirer une ligne casse toutes les suivantes.
4. **Vérification périodique** de la chaîne (tâche nocturne), avec alerte immédiate en cas de
   rupture ou de trou de séquence. Une chaîne qu'on ne vérifie jamais n'est pas une chaîne.
5. **Aucune purge** : le registre survit à la suppression d'un compte (conservation probatoire, à
   inscrire dans la politique de confidentialité **dès le Lot 1** — c'est une obligation
   d'information, pas un détail).

### L'honnêteté nécessaire

> **C'est une preuve auto-produite.** Elle est produite par INFLUX, hébergée par INFLUX, et INFLUX
> est la partie intéressée. Sa force ne vient pas de son autorité : elle vient de sa **cohérence**
> avec des éléments détenus par des tiers — l'e-mail reçu par les deux parties et ses en-têtes, les
> journaux du prestataire d'envoi, les traces de connexion. Un registre cohérent avec cinq e-mails
> tiers est convaincant ; le même registre seul ne l'est pas.

Conséquences pratiques :

- **Ne jamais écrire « horodatage certifié », « valeur probante » ou « preuve légale »** dans
  l'interface, les CGU ou un e-mail. C'est faux en l'état et ça se retournerait contre nous.
- Les termes justes : « journal d'activité », « historique de la mise en relation »,
  « confirmation envoyée le … ».
- L'**ancrage ou l'horodatage qualifié par un tiers** est une option V2, à ouvrir si un contentieux
  réel le justifie. Pas au MVP : coût et complexité sans rapport avec le risque actuel.

---

## Étape 6 — Le pipeline commercial

Le contrat et le paiement sont hors application. Le pipeline est donc **la seule chose qui dise à
INFLUX combien il gagne, sur quoi et avec qui**. C'est le remplaçant de M7 : au lieu de demander aux
utilisateurs de déclarer la suite donnée, **le commercial saisit lui-même l'issue** — c'est son
métier, c'est son intéressement, et c'est une donnée bien plus fiable obtenue sans friction.

### États de l'affaire

```
  open ──► negotiating ──► contract_sent ──► signed ──► commission_invoiced ──► commission_received
    │           │                │             │                │
    └───────────┴────────────────┴─────────────┴────────────────┴──►  lost (motif typé)
                │                │             │
                └────────────────┴─────────────┴──────────────────►  stalled  ·  disputed
```

| État | Ce qu'il signifie | Ce qui devient obligatoire |
|---|---|---|
| `open` | Conversation ouverte, rien de convenu | — |
| `negotiating` | Un montant est discuté | Montant négocié + devise |
| `contract_sent` | Contrat envoyé hors plateforme | Date d'envoi + **mode d'envoi** (e-mail, DocuSign, main propre) |
| `signed` | Contrat signé entre les parties | Date de signature, montant, **commission convenue** |
| `commission_invoiced` | INFLUX a facturé sa commission | Date + référence de facture externe |
| `commission_received` | Commission encaissée, totalement ou partiellement | Montant encaissé + date |
| `lost` | L'affaire ne se fera pas | **Motif typé** |
| `stalled` | Sans nouvelle depuis 14 jours | Alerte, pas un état subi |
| `disputed` | Litige entre les parties, ou sur la commission | Commentaire interne obligatoire |

Une affaire est **toujours rattachée à une `introduction`**. Pas de `deal` orphelin : une affaire
sans mise en relation, c'est une affaire qu'INFLUX n'a pas produite.

### Champs saisis par le commercial

| Champ | Type | Contrôle serveur |
|---|---|---|
| `negotiated_amount` | Entier en plus petite unité monétaire, ou `numeric` exact — **jamais un flottant** | > 0 |
| `currency` | ISO 4217, liste fermée | Obligatoire dès qu'un montant existe, immuable une fois `signed` |
| `agreed_commission_amount` | Même type | > 0 et **≤ `negotiated_amount`** |
| `agreed_commission_note` | Texte libre (ex. « barème standard 35 % » ou « dérogation partenariat ») | Texte, **jamais un taux exploité par le code** |
| `commission_invoice_ref` | Référence externe | — |
| `commission_received_amount` | Même type | ≤ `agreed_commission_amount`, sinon justification obligatoire |
| `commission_received_at`, `contract_sent_at`, `signed_at` | `timestamptz` | Cohérence chronologique |
| `contract_sent_channel` | `email` · `docusign` · `in_person` · `other` | Obligatoire en `contract_sent` |
| `lost_reason_code` | Liste fermée | Obligatoire en `lost` |
| `owner_agent_id` | Le commercial responsable | Repris de l'`introduction` |

**Toute modification d'un montant ou d'une date est historisée** : qui, quand, ancienne valeur,
nouvelle valeur. C'est la matière de la facturation V2 et du contentieux éventuel ; un montant
écrasé sans trace est un montant perdu.

### Rapprochement et relances

- Rapprocher `commission_received_amount` avec le relevé bancaire, par devise. Tout écart est une
  alerte, pas une correction silencieuse.
- Relance automatique au commercial sur : affaire `signed` sans commission facturée à J+7,
  `commission_invoiced` sans encaissement à J+30, `stalled` à 14 jours.
- Export comptable par devise, avec la référence `MER-…` de la mise en relation d'origine en regard
  de chaque ligne.

---

## Règle absolue

> ## **AUCUN TAUX ET AUCUN CALCUL DE COMMISSION DANS LE CODE AU MVP.**
>
> **La seule arithmétique autorisée est l'addition et la soustraction de montants saisis.
> Aucune multiplication par un taux, nulle part — ni serveur, ni front, ni export, ni e-mail.**
>
> La table `commission_rates` est **créée et reste vide**.

Pourquoi c'est une règle et pas une préférence : `CLAUDE.md` §6 impose que le calcul de la
commission n'existe **qu'à un seul endroit** dans tout le code. Un moteur écrit à moitié
maintenant — un `0,35` dans un composant, un `× 0,20` dans un export — créerait exactement la
duplication que l'invariant interdit, sans être utilisable. **Pire que rien.**

### L'exemple de référence, en régime MVP

| Élément | Valeur | Qui la produit |
|---|---|---|
| Montant du contrat (coût total annonceur) | **2 000,00 EUR** | **Saisi** par le commercial |
| Part annonceur INFLUX (20 %) | 400,00 EUR | Barème commercial, **hors application** |
| Part créateur INFLUX (15 %) | 300,00 EUR | Barème commercial, **hors application** |
| Commission INFLUX totale (35 %) | **700,00 EUR** | **Saisie** par le commercial |
| Net créateur | **1 300,00 EUR** | Affiché par simple soustraction 2 000,00 − 700,00 |
| Vérification | 400,00 + 300,00 + 1 300,00 = 2 000,00 EUR ✅ | Faite par un humain |

L'application a enregistré 2 000,00 et 700,00, affiché 1 300,00, et **n'a appliqué aucun taux**.
Elle a vérifié que 700,00 > 0 et que 700,00 ≤ 2 000,00. C'est tout ce qu'elle a le droit de faire.

Si un écran doit montrer les deux parts (400,00 et 300,00), elles sont **saisies** ou absentes —
jamais dérivées d'un pourcentage écrit dans le code.

---

## Ce qu'il faut conserver pour la V2

Chaque ligne répond à la même question : *pourquoi maintenant et pas plus tard ?*

| Table / colonne | Pourquoi maintenant |
|---|---|
| `terms_versions` + `terms_acceptances` | Une clause qu'on n'a pas fait accepter **à la date de la mise en relation** n'est opposable à personne. Reconstituer a posteriori qui avait accepté quoi est impossible. |
| `introductions.identity_revealed_at` | Date de naissance de la créance V2 et point de départ de la fenêtre de non-contournement (D29). Non reconstituable. |
| `introductions.*_country_at_intro` | Le droit applicable, la fiscalité et la validité de la clause dépendent du pays **au jour de la mise en relation**. L'utilisateur déménage, la preuve non. |
| `introductions.origin` + `origin_reason` | Prouve l'initiative d'INFLUX, en particulier pour la proposition INFLUX où aucune des parties n'a rien demandé. |
| `introductions.owner_agent_id` | Intéressement commercial, futur portefeuille de clients, et mesure du plafond de croissance. Savoir six mois plus tard qui a fait quoi est impossible sans cette colonne. |
| `introduction_events` chaîné | Une chaîne de preuve qui commence après les faits ne prouve rien. Elle doit démarrer au premier événement. |
| `deals` | Seule mesure du revenu réel et **seule assiette disponible** si la commission devient exigible en V2. |
| `commission_rates`, **vide** | Créer la table maintenant force le développeur de la V2 à lire les taux **en base**, au lieu d'écrire `0.35` en dur. Vide, elle rend tout calcul impossible au MVP. C'est un garde-fou, pas une anticipation. |
| `conversations` / `conversation_participants` / `messages` / `message_reads` | Le commercial est un participant de première classe ; les lectures par un agent doivent être journalisées (A10). |
| `contact_detections` | Signal de contournement et corpus qui servira à régler la détection. |
| `messageId` des e-mails transactionnels | Le lien entre notre registre interne et la preuve détenue par des tiers. Sans lui, on ne sait pas retrouver l'e-mail chez le prestataire. |

---

## Checklist CGU, à destination du juriste

> **Je ne suis pas avocat.** Ce qui suit est de la **matière première**, pas une rédaction
> juridique. Un professionnel du droit rédige, adapte par pays et valide avant toute mise en ligne.

La clause de non-contournement doit au minimum couvrir :

- [ ] **Définition de la mise en relation** : identifiée par sa référence (`MER-2026-000123`), sa
      date de révélation d'identité et l'identité des deux parties.
- [ ] **Fait générateur** : toute collaboration rémunérée conclue entre les deux parties et
      **issue de** cette mise en relation.
- [ ] **Assiette et barème** : renvoi au barème en vigueur (35 %, part annonceur 20 %, part créateur
      15 %) **et non un taux figé dans le corps des CGU** — sinon toute évolution du barème impose
      une nouvelle acceptation de tout le monde.
- [ ] **Durée de la fenêtre** — **D29**, à trancher par le fondateur avec le juriste.
- [ ] **Obligation de déclarer** toute collaboration issue d'une mise en relation, dans un délai
      défini.
- [ ] **Justificatifs raisonnables** côté annonceur B2B (proportionnés, limités à l'objet).
- [ ] **Clause de sauvegarde « relation préexistante »** : la partie qui prouve un contact antérieur
      à la mise en relation échappe à la clause. Sans elle, la clause est déloyale et fragilise
      l'ensemble.
- [ ] **Moratoire du pilote (A5)** : voir l'avertissement ci-dessous.
- [ ] **Langue, droit applicable et juridiction** — dépend de D25.

### Rédaction asymétrique — obligatoire

| Partie | Régime | Pourquoi |
|---|---|---|
| **Annonceur (B2B)** | **Ferme** : obligation de déclaration, indemnité forfaitaire envisageable, justificatifs | Rapport professionnel équilibré, clause pénale usuelle entre professionnels |
| **Créateur particulier (B2C)** | **Loyauté et obligation de déclaration, sans clause pénale** ; au plus une résiliation du compte | Une clause pénale à sens unique imposée à un consommateur **risque la nullité pour clause abusive** (droit de la consommation de l'UE et équivalents ailleurs). Une clause annulée ne protège personne, et son annulation contamine la crédibilité du reste. |

**Dans l'interface, jamais une menace.** Le ton est celui d'un partenaire : « dites-nous ce que
cette mise en relation a donné ». La clause vit dans les CGU ; elle n'a rien à faire dans un bandeau
d'avertissement, un e-mail de relance ou un écran de conversation. Une plateforme qui menace ses
utilisateurs perd les deux côtés de son marché avant d'avoir encaissé quoi que ce soit.

### Avertissement — le moratoire du pilote

L'arbitrage A5 pose la clause dès le jour 1 mais annonce qu'INFLUX n'en fera pas usage pendant le
pilote. **Une annonce publique de non-usage peut s'analyser en renonciation au droit** : après six
mois de « nous ne l'appliquons pas », l'invoquer devient difficile, et une partie pourra soutenir
qu'elle a contracté sur la foi de cette annonce.

Rédaction qui limite le risque, à faire valider par le juriste :

- un moratoire **daté** (« jusqu'au JJ/MM/AAAA ») et non un engagement indéfini ;
- **révocable** avec préavis, et applicable seulement aux mises en relation postérieures à la
  révocation ;
- **conditionné à la déclaration de l'affaire** : INFLUX renonce à réclamer sa commission sur les
  affaires qui lui sont déclarées, pas sur celles qui lui sont dissimulées ;
- formulé comme une **tolérance commerciale**, jamais comme une renonciation de droit.

**C'est au juriste de trancher.** Aucun agent ne rédige ce paragraphe seul.

---

## Détection de coordonnées — version allégée

> **Au MVP : on signale au commercial, on ne masque pas, on ne bloque pas.**

Le commercial est dans le fil et voit tout en temps réel. Masquer automatiquement gênerait un
échange légitime qu'il supervise déjà, et transformerait chaque faux positif en incident.

| Règle | Détail |
|---|---|
| Motifs détectés | Adresse e-mail, numéro de téléphone (**formats internationaux**), identifiant social, lien de messagerie tierce, IBAN |
| Effet | Un **signalement** visible par le commercial sur le fil, et une entrée dans la liste d'alertes du backoffice |
| Ce qui n'arrive pas | Aucun masquage, aucun blocage d'envoi, aucune sanction automatique |
| Faux positifs | Assumés. Un nom de domaine dans un brief n'est pas une tentative de contournement. |
| **Pièces jointes** | **Interdites dans la messagerie** — vecteur de contournement, surface de sécurité et charge de modération hors de portée au MVP |
| Ce qu'on stocke | Le **type** de motif et sa position, pas une copie du message (il est déjà stocké) |
| Score pondéré | **Reporté.** Pas de calcul nocturne au MVP : deux alertes suffisent — coordonnées repérées, et fil silencieux depuis 14 jours sans état commercial mis à jour. |

Politique exacte et formulation du signalement : **D30**.

---

## Indicateurs

| Indicateur | Pourquoi | Ce qu'il déclenche s'il dérive |
|---|---|---|
| **Commission encaissée** (par devise, par mois, par commercial) | **L'indicateur principal.** C'est le revenu réel. | Revue du barème et du pilote |
| **Affaires traitées par commercial et par semaine** | Le plafond de croissance est humain, pas technique | Recrutement, ou simplification du parcours commercial |
| Taux de transformation par déclencheur (`approved` → `signed`) | Dit lequel des trois déclencheurs produit du revenu | Réallocation de l'effort commercial |
| Délai de la file : prise en charge, décision (p50 / p90), % hors SLA | Premier risque produit (D39) | Escalade, renfort, révision du SLA |
| Écart commission convenue / encaissée | Taux de recouvrement réel | Relances, révision des conditions de règlement |
| Mises en relation révélées sans état commercial mis à jour à 30 jours | Signal de contournement **ou** de saisie négligée | Appel du commercial, jamais une accusation automatique |

---

## Quand NE PAS invoquer cette skill

| Sujet | Skill à utiliser |
|---|---|
| Inscription, capture et synchronisation des leads | `lead-pipeline`, `brevo-campaign`, `apollo-lead-sync` |
| Contenu des profils, vérification, badge | `profile-verification` |
| Format des messages, notifications, entrée d'un agent dans un fil | `messaging-spec` |
| **Calcul de la commission, arrondis, factures, prestataire de paiement, reversement** | `contract-commission` — **et c'est la V2, pas le MVP** |
| Recherche, facettes, tri, k-anonymat | `matching-spec` |
| Anatomie générique d'une file backoffice, actions de masse | `backoffice-ops` |
| Modélisation, migrations, RLS | `supabase-schema` |

---

## Checklist de livraison

- [ ] Les trois déclencheurs sont couverts, dont la **proposition INFLUX** (motif écrit, une
      `introduction` par créateur, file court-circuitée)
- [ ] `origin` immuable ; doublons bloqués
- [ ] Transitions de statut limitées au tableau, toutes journalisées
- [ ] Pays des deux parties et versions de CGU **copiés** sur l'`introduction`
- [ ] `identity_revealed_at` **write-once**, jamais posé sans le consentement des deux parties
- [ ] Proposition INFLUX : révélation **simultanée**, après acceptation des deux côtés
- [ ] Verrou anti-double-traitement sur la prise en charge
- [ ] Motifs de refus typés et fermés
- [ ] SLA mesuré, dépassement visible, **aucune expiration silencieuse**
- [ ] E-mail transactionnel aux **deux** parties, avec référence `MER-…`, `messageId` conservé, rejeu en cas d'échec
- [ ] Registre : `REVOKE UPDATE, DELETE` + trigger + chaînage + vérification périodique
- [ ] Aucun vocabulaire de « preuve certifiée » dans l'interface ou les documents
- [ ] **Aucun taux, aucune multiplication** ; `commission_rates` créée et vide
- [ ] Montants en entiers ou `numeric` exact, devise ISO 4217, jamais de flottant
- [ ] Toute modification de montant ou de date historisée
- [ ] Pas d'affaire sans `introduction`
- [ ] Pièces jointes interdites ; détection en signalement, pas en masquage
- [ ] Indicateurs instrumentés, **commission encaissée** en premier
- [ ] Points juridiques listés pour le juriste, sans rédaction juridique de notre part

## Format de sortie attendu

**Déclencheur** (lequel des trois, ce qui est exigé) → **Objet `introduction`** (champs, statut,
pays et CGU historisés) → **Décision et attribution** (file, verrou, motif, SLA) →
**Révélation et preuves produites** (horodatage, registre chaîné, e-mails et `messageId`) →
**État de l'affaire et montants saisis** (exemple chiffré complet avec devise, jamais calculé) →
**Données historisées** → **Impacts** sur les écrans et les documents →
**Points à faire valider** par le fondateur, un juriste ou un expert-comptable.
