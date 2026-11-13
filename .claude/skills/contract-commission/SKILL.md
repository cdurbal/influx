---
name: contract-commission
description: Appliquer la commission INFLUX de 35 % (part annonceur 20 % + part créateur 15 %) — calcul, arrondi, historisation des taux, net créateur, devise, pays ouverts, structure du contrat d'intermédiation, facturation, encaissement et reversement via le prestataire de paiement. À utiliser pour toute fonctionnalité touchant un montant, un contrat, une facture, un paiement ou un reversement.
disable-model-invocation: true
---

# Commission 35 % et contractualisation

La commission de 35 % est le revenu unique d'INFLUX. Son calcul doit être exact, traçable et
défendable devant un annonceur, un créateur, un comptable et un contrôleur.

Agents concernés : `expert-paiement-facturation` (principal), `expert-conformite-rgpd`,
`product-owner`, `expert-database`, `dev-react-node`.

## Invariants

1. **Taux par défaut : 35 %** du montant du contrat signé via INFLUX, répartis en **part
   annonceur 20 %** et **part créateur 15 %**. **Le montant du contrat est le coût total pour
   l'annonceur** : la commission est incluse, jamais ajoutée.
2. **Les deux taux sont des données en base, jamais des constantes de code.** Paramétrables, avec
   possibilité de taux dérogatoires (partenariats, offres de lancement), sur une part ou les deux.
3. **Les deux taux sont figés et historisés sur le contrat à la signature.** Une évolution
   ultérieure des taux plateforme ne modifie jamais un contrat déjà signé.
4. **Identité toujours vraie** :
   `montant du contrat = part annonceur + part créateur + net créateur`.
   Testée systématiquement, arrondis compris.
5. **Le calcul n'existe qu'à un seul endroit du code** (domaine `billing`, côté serveur).
   Aucune reproduction dans un composant, un export, un e-mail ou un document.
6. **Aucun montant ni taux accepté depuis le client.** Tout est calculé et validé côté serveur.
7. **Montants en entiers** (plus petite unité monétaire) ou décimal exact, **jamais en flottant**.
   **Une devise unique par contrat**, choisie dans la liste fermée (D27).
8. **Chaque calcul est journalisé** : contrat, montant, devise, taux appliqués, parts, net,
   horodatage, déclencheur.
9. **Contrat possible uniquement entre parties situées dans des pays ouverts** (D26), vérifié
   côté serveur à la création et à la signature.
10. **INFLUX encaisse et reverse via un prestataire de paiement agréé** (D8 tranchée, prestataire
    D9) : l'annonceur paie le montant du contrat, INFLUX retient les deux parts, le net créateur
    est reversé après validation de la publication. Aucune donnée de carte chez INFLUX.

## Calculer

```
part_annonceur = montant_contrat × taux_part_annonceur
part_createur  = montant_contrat × taux_part_createur
commission     = part_annonceur + part_createur
net_createur   = montant_contrat − commission
```

À expliciter et documenter avant toute implémentation :

- [ ] **Règle d'arrondi** unique (sens et précision) sur chaque part et dans chaque devise,
      sans jamais casser l'identité (D19).
- [ ] **Attribution du reliquat d'arrondi** : à INFLUX ou au créateur — à trancher, puis figer (D19).
- [ ] **Traitement fiscal** : montants hors taxes ou taxes comprises, TVA / GST / sales tax sur
      chaque part selon le pays de la société et celui des parties (D7).
- [ ] **Structure des factures** des deux parts : qui facture quoi à qui (D23).
- [ ] **Devises** autorisées et prise en charge des frais de conversion (D27).
- [ ] **Moment du paiement**, annulation, litige, remboursement (D20).

### Exemple à reproduire dans toute spécification

Toute règle financière est accompagnée d'un exemple chiffré complet, avec sa devise :

| Élément | Valeur |
|---|---|
| Montant du contrat (coût total annonceur, encaissé par INFLUX) | 2 000,00 EUR |
| Taux part annonceur (figé à la signature) | 20 % |
| Taux part créateur (figé à la signature) | 15 % |
| Part annonceur INFLUX | 400,00 EUR |
| Part créateur INFLUX | 300,00 EUR |
| Commission INFLUX totale (35 %) | 700,00 EUR |
| Net créateur reversé | 1 300,00 EUR |
| Vérification | 400,00 + 300,00 + 1 300,00 = 2 000,00 ✅ |

## Cas limites à couvrir obligatoirement

- [ ] Montant nul ou négatif → refusé
- [ ] Montant non divisible proprement → règle d'arrondi appliquée, identité préservée
- [ ] Taux dérogatoire (sur une part ou les deux) → historisé au contrat comme les taux standard
- [ ] Modification des taux plateforme après signature → **aucun effet** sur les contrats existants
- [ ] Partie située dans un pays non ouvert → contrat refusé
- [ ] Devise hors de la liste autorisée → refusée
- [ ] Contrat annulé après signature ou après paiement → sort de chaque part et remboursement (D20)
- [ ] Livraison partielle ou litige → fonds conservés, règle de traitement à spécifier (D20)
- [ ] Échec ou retard du reversement au créateur → statut explicite, relance, aucune perte
- [ ] Renégociation du montant avant signature → recalcul intégral
- [ ] Conversion de devise par le prestataire → taux de change et frais historisés

## Données à historiser sur le contrat

| Donnée | Pourquoi |
|---|---|
| Montant du contrat | Assiette |
| Devise | Sans ambiguïté |
| Taux part annonceur et taux part créateur appliqués | Preuve, indépendance vis-à-vis des taux courants |
| Part annonceur, part créateur, commission totale | Traçabilité comptable |
| Net créateur | Engagement envers l'influenceur |
| Pays des parties | Preuve du respect des pays ouverts, fiscalité |
| Date et heure de signature | Fait générateur |
| Identité des parties | Preuve |
| Version et langue des conditions acceptées | Défense en cas de litige |
| Mise en relation d'origine | Preuve que le contrat passe bien par INFLUX |
| Références de paiement, de reversement et de remboursement chez le prestataire | Rapprochement comptable |

> Conserver **les composantes du calcul**, pas seulement le résultat.

## Contrat d'intermédiation — structure attendue

Préparé par `expert-conformite-rgpd` et `expert-paiement-facturation`, **validé par un
professionnel du droit avant mise en ligne**. Doit couvrir au minimum :

- Identification des parties et d'INFLUX comme intermédiaire
- Objet : mise en relation et prestation de l'influenceur
- Description de la prestation : formats, livrables, délais, droits d'utilisation des contenus
- **Montant, devise, taux de commission (35 %) et ses deux parts (20 % annonceur, 15 %
  créateur), commission et net créateur — énoncés explicitement**
- Modalités de paiement via INFLUX, conservation des fonds, échéances et conditions de reversement
- Clause de non-contournement (contrat conclu hors plateforme après mise en relation INFLUX)
- Annulation, litige, remboursement, résiliation
- Obligations légales de l'influenceur selon le pays (mention du caractère commercial de la
  publication, règles de l'influence commerciale — D21)
- Exclusion des influenceurs mineurs au MVP (D15)
- Protection des données et confidentialité
- Droit applicable et juridiction (dépend du pays de la société, D25)
- Versions en français et en anglais, avec la langue qui fait foi

## Transparence obligatoire

- Le taux de 35 % et sa répartition sont **accessibles et compréhensibles avant tout
  engagement**. Une commission découverte après signature expose à un risque de pratique
  commerciale trompeuse.
- Tout écran ou document affichant un montant distingue explicitement **montant du contrat**,
  **commission INFLUX** (et ses deux parts) et **net créateur**, toujours avec la devise.
- **L'influenceur connaît son net avant de signer**, jamais après.

## Tests exigés (zone la plus testée du projet)

- [ ] Calcul nominal et vérification de l'identité part annonceur + part créateur + net = contrat
- [ ] Tous les cas d'arrondi, sur chaque part et dans chaque devise autorisée
- [ ] Taux dérogatoire sur une part ou les deux
- [ ] Immuabilité des deux taux après signature
- [ ] Refus des montants nuls ou négatifs et des devises non autorisées
- [ ] Refus d'un contrat dont une partie est hors des pays ouverts
- [ ] Refus d'un montant ou d'un taux venant du client
- [ ] Cohérence entre montant affiché, montant du contrat, montant encaissé, montant reversé et
      montants facturés
- [ ] Webhooks du prestataire : signature vérifiée, traitement idempotent (doublure en test)

## Checklist

- [ ] Calcul unique, côté serveur, dans `billing`
- [ ] Taux des deux parts lus en base et historisés au contrat
- [ ] Règle d'arrondi écrite, testée, reliquat attribué
- [ ] Exemple chiffré fourni dans la spécification, avec devise
- [ ] Journalisation du calcul en place
- [ ] Contrôle des pays ouverts côté serveur
- [ ] Affichages non ambigus validés par `expert-ux`
- [ ] Clauses contractuelles validées par `expert-conformite-rgpd`, puis par un juriste
- [ ] Décisions D7, D9, D19, D20, D23, D26, D27 tranchées ou explicitement en attente
