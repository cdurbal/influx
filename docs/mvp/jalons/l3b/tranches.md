# L3B — grille `reference.price_bands` (L3B-B)
> `expert-paiement-facturation`, 2026-11-13. **À valider par le fondateur (F1)** ; réponse : *(F1)*. Prime sur `0304` pour toute valeur. *-n* : `EC-L3B-B-n`.

## Résumé pour le fondateur
1. **Recommandation : valider telle quelle** : 5 devises, 10 tranches chacune, aucun net (D48).
2. Devises : **EUR, GBP, USD, CAD, CHF**. Toute autre devise : campagne non soumissible (Q16).
3. Motif : marchés francophones et anglophones, société en Angleterre (D25), aucune conversion (RG58).
4. Tranches : moins de 100 · 100 à 250 · 250 à 500 · 500 à 1 000 · 1 000 à 2 500 · 2 500 à 5 000 ·
   5 000 à 10 000 · 10 000 à 25 000 · 25 000 à 50 000 · 50 000 et plus.
5. Mêmes seuils dans les cinq devises : ordre de grandeur local, aucune équivalence entre devises.
6. Borne basse incluse, borne haute exclue : ni trou ni chevauchement, dernière tranche ouverte.
7. Une seule grille : budget par créateur (coût total, commission incluse, RG56) et valeur du produit
   offert (RG30).
8. La marque choisit une tranche, jamais un montant exact ; vue d'elle et des agents seuls (D78).
9. Libellés FR/EN traduits, avec le code ISO de la devise, jamais un symbole (« $ » : USD ou CAD ?).
10. Aucun taux, aucun net, aucun calcul. D27 (devise des contrats) reste ouverte.
11. Variantes : retirer une devise (10 lignes de moins) ; en ajouter une de même ordre (AUD, NZD) :
    10 lignes, mêmes seuils ; JPY, INR : seuils et codes propres, hors pilote.
12. Question : **« Grille validée telle quelle ? »**

## 1. Devises (pilote)
| Devise | Motif |
|---|---|
| EUR | zone euro : cœur francophone (France, Belgique, Luxembourg), marques européennes |
| GBP | Royaume-Uni, pays de la société (D25) |
| USD | États-Unis ; devise usuelle d'une marque hors des autres zones |
| CAD | Canada bilingue (Québec : Loi 25, CASL) |
| CHF | Suisse romande |

Unité mineure 2 pour les cinq (`0003`) : `0304` le vérifie, sinon exception. Devise unique par campagne, sans conversion ni rapprochement (RG58). Formulaire limité à ces devises (`modele.md` §1) ; ailleurs, aucune tranche choisissable : soumission refusée par `budget_band` (numéraire, affiliation) ou `product_value_band` (dotation : produit toujours envoyé, `EC-L3B-A-7`). Devise du contrat, conversion, pays ouverts : D27, D26.

## 2. Bornes
- `min_amount_minor` **incluse**, `max_amount_minor` **exclue** ; dernière tranche à `max_amount_minor` nul.
- Par devise : première borne basse 0 (-1 : tout montant ≥ 0 tombe dans une seule tranche, prêt pour RG59 levée) ; borne basse = borne haute de la précédente ; `max > min` (plus strict que `price_bands_bounds`) ; une seule tranche ouverte, la plus haute.
- Mêmes seuils nominaux dans les cinq devises (-2) : imposé par `price_bands_label_key` (clé = code, commune aux devises) avec des libellés traduits, sans `ALTER`. Échelle 1-2,5-5, du nano au méga, dotation comprise.
- Unité mineure **écrite littéralement** dans `0304`, jamais calculée (T16.1).
- `net_*`, `net_basis_label`, `net_computed_at` **nuls** partout (D48, D78) ; `introduced_at` par défaut ; `retired_at` nul.

## 3. Usages
Une grille, aucune colonne neuve : `per_creator_budget_band_code` et `product_value_band_code` ont chacune leur FK `(currency, code)` sur la même table, dans la devise de la campagne (RG30, RG58). Le sens vient du champ : coût total annonceur, commission incluse, pour le budget (RG56, `campaign.budget.bandBrand`) ; valeur du produit pour la dotation, sans commission affirmée (RG63). Tarif créateur (`07` RG65) et budget marque (`06` RG27) la reprendront (RG56). Le budget total (`total_budget_minor`), montant exact interne, est hors grille.

## 4. Libellés
Clés `price_band.<code>` ; `{currency}` = code ISO 4217 de la campagne (texte, aucun calcul). Textes traduits (-3) : la conversion exemptée n'existe pas (T16.6, T16.7) et L3B n'en ajoute aucune (`revue.md`) ; le montant stocké n'est jamais lu pour l'affichage. Milliers : FR espace fine insécable (U+202F, celle du tableau), EN virgule ; espace insécable avant `{currency}`. Des mots, pas de tiret (un lecteur d'écran lit « 100 – 250 » « 100 250 »). Borne haute affichée arrondie (-4) : « 100 à 250 » exclut 250, qui ouvre la suivante ; sans effet, aucun montant n'est saisi.

| Code | FR | EN |
|---|---|---|
| `under_100` | Moins de 100 {currency} | Under 100 {currency} |
| `100_250` | 100 à 250 {currency} | 100 to 250 {currency} |
| `250_500` | 250 à 500 {currency} | 250 to 500 {currency} |
| `500_1000` | 500 à 1 000 {currency} | 500 to 1,000 {currency} |
| `1000_2500` | 1 000 à 2 500 {currency} | 1,000 to 2,500 {currency} |
| `2500_5000` | 2 500 à 5 000 {currency} | 2,500 to 5,000 {currency} |
| `5000_10000` | 5 000 à 10 000 {currency} | 5,000 to 10,000 {currency} |
| `10000_25000` | 10 000 à 25 000 {currency} | 10,000 to 25,000 {currency} |
| `25000_50000` | 25 000 à 50 000 {currency} | 25,000 to 50,000 {currency} |
| `50000_plus` | 50 000 {currency} et plus | 50,000 {currency} or more |

## 5. Pour `0304`
Cinquante lignes, mot pour mot : les cinq devises × les dix tranches.
```sql
insert into reference.price_bands (currency, code, label_key, min_amount_minor, max_amount_minor)
select c.currency, b.code, 'price_band.' || b.code, b.min_amount_minor, b.max_amount_minor
from (values ('CAD'), ('CHF'), ('EUR'), ('GBP'), ('USD')) as c (currency)
cross join (values
  ('under_100',   0::bigint, 10000::bigint),
  ('100_250',       10000,    25000),
  ('250_500',       25000,    50000),
  ('500_1000',      50000,   100000),
  ('1000_2500',    100000,   250000),
  ('2500_5000',    250000,   500000),
  ('5000_10000',   500000,  1000000),
  ('10000_25000', 1000000,  2500000),
  ('25000_50000', 2500000,  5000000),
  ('50000_plus',  5000000,     null)
) as b (code, min_amount_minor, max_amount_minor);
```
Assertions de fin : dix lignes par devise, contiguïté et tranche ouverte selon §2, nets nuls, devises actives à unité mineure 2.
