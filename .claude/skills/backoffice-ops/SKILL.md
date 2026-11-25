---
name: backoffice-ops
description: Concevoir un écran ou une opération du backoffice INFLUX, outil professionnel utilisé huit heures par jour — anatomie d'une file de validation, prise en charge avec verrou anti-double-traitement, SLA, motifs typés, attribution et réattribution, actions de masse et double validation, traçage de toute action et de toute lecture privilégiée, surface isolée, densité et accessibilité. À invoquer pour toute fonctionnalité utilisée par un commercial ou un administrateur INFLUX, et pour le pendant interne de toute fonctionnalité côté membres.
---

# Concevoir une opération de backoffice

`CLAUDE.md` le dit sans ambiguïté : **le backoffice est un produit à part entière, pas un écran
d'admin bricolé.** Il est utilisé huit heures par jour et c'est lui qui porte la rentabilité
opérationnelle. Le plafond de croissance d'INFLUX n'est pas technique, **il est humain** : chaque
mise en relation mobilise un commercial, et chaque clic économisé est de la capacité commerciale
gagnée.

Agents concernés : `product-owner` (principal), `expert-ux`, `expert-cybersecurite` (**veto**),
`expert-conformite-rgpd` (**veto**), `architecte`.

## Principe directeur

> **Toute action d'un agent est tracée et motivée.** Un backoffice qui permet une action anonyme,
> ou une action sans motif, est un backoffice défectueux — quel que soit son confort d'usage.

Si une action ne peut pas être attribuée à une personne nommée et rattachée à un motif exploitable,
elle ne doit pas exister sous cette forme.

## Les 46 règles, où les lire

Les règles gardent leur numéro (les spécifications les citent : `15` RG28 renvoie à la règle 9).

| Fichier | Contenu | Quand le lire |
|---|---|---|
| `references/files-et-motifs.md` | Étapes 1 et 2, règles 1 à 10 : catalogue des files (renvoi `15` RG29, `17b` §1.3), les sept points d'une file, verrou, SLA, motifs typés | Concevoir ou modifier une file, un tri, un motif de refus |
| `references/masse-2v-attribution.md` | Étapes 3 à 5, règles 11 à 20 : actions de masse, actions irréversibles, double validation et procédure dégradée, attribution | Action de masse, e-mail, retrait de badge, suppression, réattribution |
| `references/surface-supervision-densite.md` | Étapes 6 à 8 et 10, règles 21 à 39 : surface privilégiée, supervision et alertes, densité, mobile, cas limites | Hôte, MFA, journal de lecture, tableau de bord, alertes, écran dense |

## Étape 9 — Ce qu'un agent ne doit jamais pouvoir faire

Liste à vérifier écran par écran. Chacun de ces points est un **défaut bloquant** s'il est possible.

40. **Modifier ou supprimer une entrée du journal d'audit.** Le journal est en ajout seul, garanti
    en base, pas par convention.
41. **Modifier un montant d'affaire sans trace.** Toute modification conserve l'ancienne valeur,
    son auteur et son horodatage.
42. **Envoyer un e-mail de masse sans double confirmation** (ou sans la confirmation différée
    journalisée de la règle 14).
43. **Consulter une pièce de vérification ou une conversation sans que ce soit journalisé.**
44. **Exporter l'annuaire** des membres, sous quelque forme que ce soit — y compris par une
    pagination détournée ou un export de liste.
45. **Désactiver sa propre traçabilité**, ou agir sous une autre identité que la sienne.
46. **Agir sur son propre compte** en tant qu'agent (auto-attribution de droits, auto-validation).

## Checklist avant livraison

- [ ] Chaque action est attribuée à une personne nommée et rattachée à un motif exploitable
- [ ] Verrou anti-double-traitement, avec expiration et libération explicite
- [ ] Tri par défaut décidé, SLA écrit, comportement au dépassement spécifié (D39, D49)
- [ ] Motifs **typés**, liste fermée par file, message utilisateur associé à chaque motif
      défavorable, texte libre en complément seulement
- [ ] Actions de masse : plafond, aperçu, confirmation séparée, réversibilité annoncée, échec
      partiel traité, lot journalisé
- [ ] Actions irréversibles identifiées ; double validation **ou** confirmation différée
      journalisée, avec mention explicite du caractère affaibli du contrôle
- [ ] Commercial responsable porté par chaque compte et chaque affaire, historique conservé
- [ ] Réattribution avant désactivation d'un compte agent
- [ ] Hôte distinct, non-indexé, MFA, session courte
- [ ] Lectures de conversations, de pièces et d'identités journalisées
- [ ] Journal d'audit en ajout seul, non modifiable par un agent
- [ ] Export de l'annuaire impossible
- [ ] Tableaux, raccourcis clavier, actions sans souris, états vides utiles
- [ ] Couleur jamais seul porteur d'information ; tokens du design system uniquement
- [ ] Indicateur « mises en relation traitées par commercial et par semaine » instrumenté
- [ ] Revues `expert-cybersecurite` et `expert-conformite-rgpd` (vetos) demandées

## Format de sortie

Opération et acteur interne → file concernée (entrée, tri, verrou, attribution, SLA, sortie
motivée, réattribution) → motifs typés et messages → actions de masse et irréversibles →
attribution → traçage (actions, lectures privilégiées, journal) → supervision et alertes → densité
et accessibilité → interdits → cas limites → critères d'acceptation (via `feature-spec`) →
questions ouvertes avec leur arbitre.

## Quand NE PAS invoquer cette skill

- **Écrans destinés aux membres** (marque, créateur) → `feature-spec` + `design-system-influx`.
- **Tables, colonnes, RLS, index, rétention** → `supabase-schema`.
- **Contenu, segments et base légale des e-mails** → `brevo-campaign` et `apollo-lead-sync`.
- **Règles métier de la mise en relation, registre chaîné, pipeline d'affaire** →
  `intermediation-tracking`.
- **Critères et procédure du badge** → `profile-verification`.
- **Règles de la conversation à trois** → `messaging-spec`.
- **Mécanique de la file d'événements de leads** (retries, idempotence) → `lead-pipeline` ; ici
  on ne spécifie que **ce que l'agent en voit et en fait**.
- **Revue de sécurité ou de conformité** → `security-rgpd-audit`.

## Questions ouvertes

| Sujet | État |
|---|---|
| SLA de la file de validation | Tranché : D39, D49 ; délai par file dans `15` RG29 |
| Durée des verrous, plafonds de masse | Tranchés : `15` RG29 (verrou 30 min, rejeu plafonné à 200) |
| D35 saisie libre d'e-mails (`expert-conformite-rgpd` + fondateur) · D36 langue du backoffice (fondateur) | **Ouvertes**, échéance Lot 5 |
| Suppression de compte pendant une affaire | Cadre D72 ; reste DZ-2 (`expert-conformite-rgpd`, `expert-paiement-facturation`) |
| Durée de session, coût de la journalisation (`expert-cybersecurite` + `architecte`) | Conditions de session avant le Lot 4 (D58) |
