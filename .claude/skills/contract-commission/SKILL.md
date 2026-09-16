---
name: contract-commission
description: Appliquer la commission INFLUX de 35 % — calcul, arrondi, historisation du taux, net créateur, structure du contrat d'intermédiation et de la facturation. À utiliser pour toute fonctionnalité touchant un montant, un contrat, une facture ou un reversement.
---

# Commission 35 % et contractualisation

La commission de 35 % est le revenu unique d'INFLUX. Son calcul doit être exact, traçable et
défendable devant un annonceur, un créateur, un comptable et un contrôleur.

Agents concernés : `expert-paiement-facturation` (principal), `expert-conformite-rgpd`,
`product-owner`, `expert-database`, `dev-react-node`.

## Invariants

1. **Taux par défaut : 35 %** du montant du contrat signé via INFLUX.
2. **Le taux est une donnée en base, jamais une constante de code.** Paramétrable, avec
   possibilité de taux dérogatoires (partenariats, offres de lancement).
3. **Le taux est figé et historisé sur le contrat à la signature.** Une évolution ultérieure du
   taux plateforme ne modifie jamais un contrat déjà signé.
4. **Identité toujours vraie** : `montant du contrat = commission INFLUX + net créateur`.
   Testée systématiquement, arrondis compris.
5. **Le calcul n'existe qu'à un seul endroit du code** (domaine `billing`, côté serveur).
   Aucune reproduction dans un composant, un export, un e-mail ou un document.
6. **Aucun montant ni taux accepté depuis le client.** Tout est calculé et validé côté serveur.
7. **Montants en entiers** (plus petite unité monétaire) ou décimal exact, **jamais en flottant**.
   Devise explicite.
8. **Chaque calcul est journalisé** : contrat, montant, taux appliqué, résultat, horodatage,
   déclencheur.

## Calculer

```
commission   = montant_contrat × taux_applique
net_createur = montant_contrat − commission
```

À expliciter et documenter avant toute implémentation :

- [ ] **Règle d'arrondi** unique (sens et précision), écrite et testée.
- [ ] **Attribution du reliquat d'arrondi** : à INFLUX ou au créateur — à trancher, puis figer.
- [ ] **Assiette HT ou TTC** (décision **D7**, ouverte) et traitement de la TVA sur la commission.
- [ ] **Devise** et comportement en cas de devise multiple.

### Exemple à reproduire dans toute spécification

Toute règle financière est accompagnée d'un exemple chiffré complet :

| Élément | Valeur |
|---|---|
| Montant du contrat | 2 000,00 € |
| Taux appliqué (figé à la signature) | 35 % |
| Commission INFLUX | 700,00 € |
| Net créateur | 1 300,00 € |
| Vérification | 700,00 + 1 300,00 = 2 000,00 ✅ |

## Cas limites à couvrir obligatoirement

- [ ] Montant nul ou négatif → refusé
- [ ] Montant non divisible proprement → règle d'arrondi appliquée, identité préservée
- [ ] Taux dérogatoire → historisé au contrat comme le taux standard
- [ ] Modification du taux plateforme après signature → **aucun effet** sur les contrats existants
- [ ] Contrat annulé après signature → que devient la commission ? (à spécifier avant production)
- [ ] Livraison partielle ou litige → règle de traitement à spécifier
- [ ] Renégociation du montant avant signature → recalcul intégral
- [ ] Devise différente → conversion et taux de change historisés

## Données à historiser sur le contrat

| Donnée | Pourquoi |
|---|---|
| Montant du contrat | Assiette |
| Taux appliqué | Preuve, indépendance vis-à-vis du taux courant |
| Commission calculée | Traçabilité comptable |
| Net créateur | Engagement envers l'influenceur |
| Devise | Sans ambiguïté |
| Date et heure de signature | Fait générateur |
| Identité des parties | Preuve |
| Version des conditions acceptées | Défense en cas de litige |
| Mise en relation d'origine | Preuve que le contrat passe bien par INFLUX |

> Conserver **les composantes du calcul**, pas seulement le résultat.

## Contrat d'intermédiation — structure attendue

Préparé par `expert-conformite-rgpd` et `expert-paiement-facturation`, **validé par un
professionnel du droit avant mise en ligne**. Doit couvrir au minimum :

- Identification des parties et d'INFLUX comme intermédiaire
- Objet : mise en relation et prestation de l'influenceur
- Description de la prestation : formats, livrables, délais, droits d'utilisation des contenus
- **Montant, taux de commission (35 %), commission et net créateur — énoncés explicitement**
- Modalités et échéances de paiement
- Clause de non-contournement (contrat conclu hors plateforme après mise en relation INFLUX)
- Annulation, litige, résiliation
- Obligations légales de l'influenceur (mention du caractère commercial de la publication)
- Régime applicable aux influenceurs mineurs, ou exclusion assumée
- Protection des données et confidentialité
- Droit applicable et juridiction

## Transparence obligatoire

- Le taux de 35 % est **accessible et compréhensible avant tout engagement**. Une commission
  découverte après signature expose à un risque de pratique commerciale trompeuse.
- Tout écran ou document affichant un montant distingue explicitement **montant du contrat**,
  **commission INFLUX** et **net créateur**.
- **L'influenceur connaît son net avant de signer**, jamais après.

## Tests exigés (zone la plus testée du projet)

- [ ] Calcul nominal et vérification de l'identité comptable
- [ ] Tous les cas d'arrondi
- [ ] Taux dérogatoire
- [ ] Immuabilité du taux après signature
- [ ] Refus des montants nuls ou négatifs
- [ ] Refus d'un montant ou d'un taux venant du client
- [ ] Cohérence entre montant affiché, montant du contrat et montant facturé

## Checklist

- [ ] Calcul unique, côté serveur, dans `billing`
- [ ] Taux lu en base et historisé au contrat
- [ ] Règle d'arrondi écrite, testée, reliquat attribué
- [ ] Exemple chiffré fourni dans la spécification
- [ ] Journalisation du calcul en place
- [ ] Affichages non ambigus validés par `expert-ux`
- [ ] Clauses contractuelles validées par `expert-conformite-rgpd`, puis par un juriste
- [ ] Décisions D7 / D8 / D9 tranchées ou explicitement en attente
