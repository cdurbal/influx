---
name: matching-spec
description: Définir ou faire évoluer la recherche de créateurs et le moteur de mise en relation INFLUX — facettes de recherche, anonymisation par tranches, k-anonymat, tri explicable, vue commerciale identifiée, puis critères, pondérations, règles d'exclusion, explicabilité et mesure de la pertinence. À utiliser pour toute évolution de la recherche ou du matching.
---

# Spécifier la recherche et la mise en relation INFLUX

La mise en relation déclenche les affaires, donc la commission de 35 %. Une règle de recherche ou de
matching n'est bonne que si elle augmente le nombre d'affaires signées.

Agents : `expert-matching` (principal), `product-owner` (valide), `expert-database`, `expert-ux`,
`expert-cybersecurite` (champs interdits, garde-fous), `expert-conformite-rgpd` (veto).

**Ce qui fait foi :** `docs/mvp/10-recherche-createurs-anonymisee.md` (recherche de créateurs) et
`docs/mvp/11` (recherche de campagnes côté créateur, qui reprend la taxonomie d'ici). Lire `10` par
sections (`Grep -n "^### "`), jamais en entier. Ce fichier donne les règles ; le détail est dans
`references/`, à lire à la demande.

## État au pilote

- **Recherche libre sur profils anonymisés** (A2, D16 étendue) ; **aucun algorithme de scoring**
  (D11 reportée). La Partie A s'applique ; la Partie B attend les données.
- **D78 (fondateur, 2026-11-01, étendue au Lot 3 le 2026-11-13) : aucun tarif ni montant côté
  créateur.** Ni facette F12, ni tri par tarif, ni critère « tarif compatible avec le budget », ni
  exclusion « tarif hors budget » : tout critère économique est **renvoyé en V2**. Le budget de
  campagne, en tranche, n'est vu que du commercial (`09` §F, `10` bandeau D78).

## Principe : dispositif hybride

**L'algorithme propose et priorise, l'agent humain décide.** Toute spécification décrit les deux
voies (ce qui est calculé ; ce que l'agent force, écarte, annote ou réordonne au backoffice) et trace
chaque intervention humaine, qui devient un signal d'amélioration. Au MVP, la première voie se réduit
à une recherche à facettes et un tri explicable ; les données du futur score sont collectées dès
maintenant.

## Règles (Partie A), avec leur renvoi à `10`

1. **A1 Continuité.** Une facette est un futur critère : liste fermée ou tranche, taxonomie unique et
   versionnée partagée par le profil, la campagne et la recherche. Le journal des recherches est le
   jeu de données de D11.
2. **A2 Tranches.** Jamais de valeur exacte dans la couche anonyme ni dans une explication ; bornes
   identiques partout (`10` RG6).
3. **A3 Champs interdits.** Liste fermée jamais servie au rôle `advertiser` avant révélation ; le
   contrôle porte sur la réponse de l'API, pas sur l'écran (`10` RG48).
4. **A4 Anonymisation en base.** Objet identifiant sans `GRANT` au rôle annonceur, objet anonymisé seul
   lisible, révélation par politique SQL ; jamais un filtre côté front (`10` §I).
5. **A5 k-anonymat.** Seuil 5, message identique à 0 et à 4 résultats, élargissements pré-construits,
   bouton « Demander une sélection à l'équipe INFLUX » ; recherche fermée sous la masse critique D38
   (`10` §F).
6. **A6 Carte.** Alias stable, global, non dérivé, non séquentiel, non genré ; deux actions seulement ;
   aucun montant au pilote (`10` §E).
7. **A7 Tri.** Paliers lisibles et déterministes, jamais un score nu ; explication de 2 à 4 raisons
   vérifiables sur la carte, sans nombre exact ni montant, en français et en anglais ; cas froid
   traité (neutre, quota, rotation) (`10` §D).
8. **A8 Exclusions silencieuses.** Un profil exclu est absent, sans message ni décompte ; une paire
   déjà en relation reste visible et signalée (`10` §C).
9. **A9 Garde-fous.** Pagination plafonnée, export interdit, débit limité, journal, détection
   d'affinage, modération visuel par visuel (`10` §G).
10. **A10 Vue commerciale.** Même moteur, différences assumées et facettes réservées ; le
    pré-remplissage depuis une campagne et ses corrections sont journalisés (`10` §H).
11. **A11 Facettes.** Socle réduit (7 au pilote, F12 suspendue), seconde vague ouverte au volume,
    facettes écartées documentées (`10` §B).
12. **A12 Conformité.** Aucun critère sur une caractéristique protégée du créateur ; genre et âge
    portent sur l'audience ; secteurs refusés jamais exposés ; information des créateurs ; avis
    `expert-conformite-rgpd` avant l'ouverture.
13. **A13 et A14 Mesure et tests.** Entonnoir recherche, demande de contact, affaire signée ; cas CT1 à
    CT20, dont **CT1, CT2 et CT5 bloquants** (`10` §J et critères d'acceptation).

## Check-list avant de livrer une spécification

- [ ] Les deux voies sont décrites ; chaque intervention humaine est tracée.
- [ ] Toute facette ou tout critère nouveau est une liste fermée ou une tranche du référentiel commun.
- [ ] Aucun champ de la liste A3 dans une réponse servie à une marque, vérifié sur le JSON.
- [ ] L'anonymisation repose sur la séparation d'objets en base.
- [ ] Seuil k, message identique à 0 et 4, porte de sortie commerciale.
- [ ] Tri nommé et déterministe ; explication sans nombre exact ni montant, traduite.
- [ ] Exclusions silencieuses ; cas froid explicite.
- [ ] Garde-fous et journal ; durée de conservation soumise à `expert-conformite-rgpd`.
- [ ] Aucun tarif, aucun montant, aucun critère économique au pilote ; renvoi en V2 écrit (D78).
- [ ] Indicateurs, cas de test, validation `product-owner` et `expert-conformite-rgpd`.

## Références, à lire à la demande

| Fichier | Contenu | Quand le lire |
|---|---|---|
| `references/recherche-anonymisee.md` | A1 à A6, A8, A9, A12 : continuité, tranches, champs interdits, anonymisation en base, k-anonymat, carte, exclusions, garde-fous, conformité | Toute story qui touche ce qu'une marque voit d'un créateur |
| `references/tri-facettes-vue-commerciale.md` | A7, A10, A11, A13, A14 : tri et explication, vue commerciale, facettes, mesure, cas de test | Tri, facettes, proposition INFLUX, plan de test |
| `references/moteur-pondere.md` | Partie B (étapes 1 à 8), données manquantes, format de sortie | À la réouverture de D11 seulement |

## Quand NE PAS invoquer cette skill

- **Dessiner** l'écran, la carte ou la surcharge → `expert-ux`, `design-system-influx`.
- File de validation, révélation, conversation à trois → `intermediation-tracking`, `messaging-spec`.
- Badge, niveaux et procédure → `profile-verification` (F17 le consomme).
- Modèle de données, migrations, RLS → `supabase-schema`, `expert-database`.
- Destinataires d'un e-mail → `brevo-campaign` (autre base légale, autres garde-fous).
- Tri d'une liste de backoffice sans enjeu de pertinence commerciale.
- Recherche de campagnes côté créateur → `feature-spec` et `docs/mvp/11`, sauf taxonomie et facettes,
  définies ici.
- **Algorithme de scoring : pas au MVP** (D11 reportée).
