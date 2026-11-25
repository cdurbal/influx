---
name: messaging-spec
description: Concevoir la messagerie à trois d'INFLUX — conversation ouverte uniquement après validation d'une mise en relation, commercial visible et nommé dans chaque fil, visibilité avant et après la révélation d'identité, notifications sans le texte du message, pièces jointes interdites, signalement et blocage, lecture d'un agent non participant journalisée, statut juridique des échanges. À invoquer dès qu'une story touche un fil de discussion, une notification de message, la supervision ou la conservation des échanges entre une marque et un créateur.
---

# Spécifier la messagerie à trois

INFLUX n'héberge pas une messagerie : il héberge **une salle de négociation supervisée**. Le
commercial présent dans le fil est la première protection du modèle économique — bien avant toute
clause juridique ou tout mécanisme de détection. Une fonctionnalité qui affaiblit sa présence
affaiblit le revenu.

Agents concernés : `product-owner` (principal), `expert-conformite-rgpd` (**veto**), `expert-ux`,
`expert-cybersecurite`.

## Principe directeur

> **Aucune conversation ne s'ouvre entre deux membres seuls.** Toute conversation naît d'une mise
> en relation validée et comporte, dès son premier message, un commercial INFLUX **visible et
> nommé**.

Conséquence à ne jamais perdre de vue : il n'existe pas de « bouton contacter ». Contacter, c'est
demander ; ouvrir, c'est décider, et c'est un commercial qui décide.

---

## Étape 1 — Partir du bon déclencheur

Une conversation n'est jamais le premier objet créé. Elle est la **conséquence** d'une mise en
relation validée (objet `introduction`, cf. `intermediation-tracking`).

| Déclencheur | Qui l'initie | Ce que ça produit immédiatement |
|---|---|---|
| **Demande de contact** | Une marque, depuis un profil créateur anonymisé | Une entrée dans la file de validation. **Pas de conversation.** |
| **Candidature** | Un créateur, depuis une campagne publiée | Une entrée dans la file de validation. **Pas de conversation.** |
| **Proposition INFLUX** | Un commercial, depuis une campagne, vers **un ou plusieurs** créateurs sélectionnés dans la recherche en vue identifiée | **Court-circuite la file** (le commercial est déjà le décideur et s'attribue l'affaire). Produit **une `introduction` et une conversation distinctes par créateur**, jamais un fil groupé. |

**RG de référence à reprendre dans toute spécification** : une conversation ne peut exister sans
une `introduction` validée qui la porte. Une conversation orpheline est un défaut bloquant.

**Règle de tempo pour la proposition INFLUX** : c'est le geste métier que le fondateur exerce déjà
au téléphone. Dans l'outil, il doit être **au moins aussi rapide qu'un coup de fil**. Toute étape
ajoutée à ce parcours doit être justifiée par un risque réel.

---

## Étape 2 — Poser le modèle

À spécifier systématiquement, sans en sauter un :

| Objet | Ce qu'il porte au minimum |
|---|---|
| **Conversation** | La mise en relation d'origine, la campagne concernée, l'état du fil, la date d'ouverture |
| **Participant** | La personne, **son rôle** (marque, créateur, commercial), **sa date d'entrée**, sa date de sortie éventuelle |
| **Message** | Son auteur réel, son horodatage, son contenu, son état de délivrance |
| **Lecture** | Qui a lu, quoi, quand — y compris les lectures d'agents **non participants** (étape 6) |

**Règles non négociables :**

1. **Une conversation a trois participants dès l'origine** : la marque, le créateur, le commercial
   responsable. Le commercial n'est pas un observateur ajouté après coup, c'est un participant de
   première classe.
2. **L'ajout d'un agent en cours de route est un événement visible** : message système horodaté
   dans le fil (« Thomas — INFLUX a rejoint la conversation le 14 mars à 10 h 12 »). **Jamais un
   ajout silencieux.** Le départ d'un participant suit la même règle.
3. **L'auteur réel d'un message est immuable.** Aucun mécanisme d'écriture « au nom de » quelqu'un
   d'autre n'existe, pour personne, y compris un administrateur.
4. Le modèle de données correspondant se spécifie avec `supabase-schema` — pas ici.

---

## Étape 3 — Définir le cycle de vie du fil

| État | Signification | Ce qui y fait entrer | Qui peut le déclencher |
|---|---|---|---|
| **Ouverte** | Créée, identités révélées, aucun message échangé | Validation de la mise en relation ou proposition INFLUX | Système |
| **Active** | Au moins un message d'une des deux parties | Premier message | Système |
| **En pause** | Négociation suspendue, fil consultable, écriture possible | Décision du commercial, ou silence prolongé (seuil à fixer) | Commercial |
| **Close** | Négociation terminée, écriture fermée, fil consultable | Décision du commercial **avec motif typé obligatoire** | Commercial |
| **Archivée** | Sortie des listes courantes, accessible sur recherche | Ancienneté, ou clôture de l'affaire | Système, commercial |

**Règles :**

5. **Une clôture sans motif typé est impossible.** Le motif alimente le pipeline commercial et la
   mesure du produit (cf. `backoffice-ops`, section motifs typés).
6. **Aucun état ne supprime le fil.** Clore, archiver et supprimer sont trois choses différentes ;
   seule la troisième n'existe pas au MVP.
7. Chaque transition est journalisée avec son auteur.

---

## Étape 4 — Spécifier la visibilité, avant et après la révélation

L'anonymat ne survit pas à l'ouverture de la conversation : la révélation d'identité est l'**effet
de la seconde acceptation des parties, après la validation du commercial** (D45), jamais une action
libre de l'utilisateur. Elle révèle l'identité, **jamais l'e-mail ni le téléphone** (D46). Mais le fil doit **rappeler en
permanence ce qui a été révélé, à qui, et quand**.

| Donnée | Avant validation | Après ouverture de la conversation |
|---|---|---|
| Thématiques, pays, audience en tranches, formats, badge (tarifs : renvoyés en V2, aucun n'est saisi ni affiché au pilote, D78) | Visible | Visible |
| Portfolio (visuels modérés) | Visible | Visible |
| Pseudo, `@`, liens réseaux, captures d'écran du créateur | **Masqué** | Révélé, horodaté |
| Identité de la marque | Visible | Visible |
| **Coordonnées directes des deux côtés** (e-mail, téléphone, site de contact) | **Masqué** | **Reste masqué dans le produit** |

**Règles non négociables :**

8. **Le masquage des coordonnées est symétrique.** Un e-mail affiché sur un profil marque est
   exactement le même vecteur de contournement qu'un `@` affiché sur un profil créateur. Toute
   spécification qui protège un seul côté est incomplète.
9. **La révélation est horodatée et journalisée** : c'est la preuve d'intermédiation
   (cf. `intermediation-tracking`). Elle n'est jamais rétroactive et ne s'annule pas.
10. **Le fil affiche un rappel permanent de la révélation** en en-tête : quelles identités ont été
    révélées, à quelle date, au titre de quelle campagne. Pas une note perdue dans l'historique.
11. La révélation déclenche un **e-mail de confirmation aux deux parties** avec la référence de la
    mise en relation. C'est autant une confirmation professionnelle attendue qu'une preuve.

---

## Étape 5 — Spécifier les notifications

12. **Règle non négociable : le texte du message ne figure jamais dans l'e-mail de notification.**

Forme imposée :

> « Vous avez reçu un message de **Marie — INFLUX** à propos de la campagne *Lancement
> printemps*. » + un lien vers le fil.

Trois raisons, à reprendre telles quelles si quelqu'un conteste :

- **Économique** — un e-mail qui contient le texte permet de répondre par e-mail, donc de sortir
  du fil supervisé. C'est la fuite de plateforme la plus facile à créer sans le vouloir.
- **Juridique et confidentialité** — dupliquer le contenu d'une négociation chez un sous-traitant
  d'emailing, sans nécessité, est une exposition gratuite de données personnelles et
  commerciales.
- **Traçabilité** — un message lu dans l'e-mail n'est pas un message lu dans INFLUX : les accusés
  de lecture et la journalisation deviennent faux.

Règles complémentaires :

13. Le nom affiché dans la notification respecte l'état de révélation : jamais un pseudo non
    encore révélé dans un objet d'e-mail.
14. Les notifications sont **regroupées** au-delà d'un seuil (pas un e-mail par message) et le
    seuil est spécifié, pas laissé à l'implémentation.
15. Aucun lien de réponse directe par e-mail. Aucune adresse de réponse fonctionnelle.
16. Le paramétrage des notifications de messagerie est **distinct du consentement marketing** :
    ce sont des e-mails transactionnels, ils ne se désabonnent pas comme une campagne. Voir
    `brevo-campaign`.

---

## Étape 6 — Encadrer la présence et la lecture des agents INFLUX

### Le commercial dans le fil

17. **Identification obligatoire et constante** au format « Prénom — INFLUX », avec une marque
    visuelle de rôle distincte des deux parties (couleur et libellé, jamais la couleur seule, cf.
    `design-system-influx`).
18. **Interdiction absolue d'un message qui semble venir d'une des parties.** Pas d'écriture
    déléguée, pas de message anonyme « INFLUX », pas de compte générique.
19. Chaque intervention du commercial est tracée avec son identité réelle, y compris s'il agit
    depuis le backoffice.

### La lecture par un agent non participant

Au MVP, **tous les commerciaux peuvent lire toutes les conversations**. C'est assumé : l'équipe
est petite, la continuité de service prime, et un fil bloqué parce que son commercial est absent
coûte une affaire.

20. **Règle non négociable : toute lecture d'une conversation par un agent non participant est
    journalisée** — qui, quand, quelle conversation. Sans exception, y compris pour un
    administrateur.

Pourquoi cette règle vaut d'être défendue, même quand elle paraît lourde :

- C'est une **exigence légale et contractuelle** : les CGU annoncent une supervision ; une
  supervision non tracée est une promesse invérifiable.
- C'est une **exigence de confiance** vis-à-vis des deux populations, qui négocient des montants
  dans ce fil.
- C'est surtout la **base technique du contrôle d'accès de demain**. Le jour où les commerciaux
  auront un portefeuille de clients, le passage d'« on trace tout » à « on n'autorise que son
  portefeuille » ne sera qu'un changement de règle d'accès sur un journal déjà en place. Si la
  journalisation n'existe pas dès le premier jour, ce passage devient une reprise de données.

Voir `security-rgpd-audit` pour la revue, et `backoffice-ops` pour la restitution de ce journal.

---

## Étape 7 — Pièces jointes et canal de documents

### Les pièces jointes au fil sont interdites au MVP

21. **Aucun fichier ne peut être attaché à un message.**

La raison est à dire franchement : **sans cette interdiction, la détection de coordonnées devient
du théâtre.** Une capture d'écran d'un numéro de téléphone, une carte de visite photographiée, un
QR code passent toute détection textuelle. S'y ajoutent deux risques : un canal d'exfiltration de
fichiers non modérés, et l'hébergement de contenus illicites dont la plateforme répondrait.

### Mais un canal de documents existe, rattaché à la mise en relation

*(proposition à valider par le fondateur — question ouverte n° 4)*

Interdire les fichiers sans offrir d'alternative ne supprime pas le besoin : le commercial
enverra le brief par e-mail et videra le fil de sa substance. Le besoin est donc traité, mais
ailleurs et autrement.

| | **Message** | **Document** |
|---|---|---|
| Rattaché à | La conversation | **La mise en relation**, pas au message |
| Publication | Instantanée | **Après contrôle d'un agent** |
| Modération | Aucune | Obligatoire avant mise à disposition de l'autre partie |
| Types acceptés | — | **Liste fermée : PDF, image** |
| Nom affiché | — | Libellé choisi dans une liste ou normalisé, **jamais le nom de fichier brut** |

22. Le dépôt est possible par le commercial ou par une partie ; la **mise à disposition de l'autre
    partie n'a lieu qu'après contrôle par un agent**.
23. Chaque dépôt, chaque contrôle et chaque téléchargement sont journalisés.
24. Le nom de fichier d'origine n'est jamais affiché tel quel : c'est un champ de texte libre, donc
    un vecteur de coordonnées (`devis-jean-0612345678.pdf`).
25. La distinction à énoncer dans l'interface, en une phrase : **un message part tout de suite et
    n'est pas relu ; un document est contrôlé avant d'être transmis.**

Les fichiers qui ont déjà leur place ailleurs n'entrent pas dans ce canal : portfolio (profil,
modéré), pièces de vérification (stockage privé, cf. `profile-verification`), brief structuré
(fiche campagne).

---

## Étape 8 — Signalement, blocage et détection de coordonnées

### Signalement

26. Un utilisateur peut signaler : un contenu déplacé ou agressif, une **tentative de sortie de
    plateforme**, un soupçon d'usurpation, un contenu illicite, « autre » (motif rare et
    surveillé). Liste fermée, comme partout (cf. `backoffice-ops`).
27. Un signalement crée une entrée dans la file « signalements » du backoffice, avec un SLA propre.
    Il **n'interrompt pas** automatiquement la conversation : c'est un agent qui décide.
28. Le signalant reçoit une confirmation de prise en compte, et l'information que le fil est
    supervisé.

### Blocage

29. Un blocage entre parties **ne supprime pas le fil** et ne supprime pas l'affaire : il ferme
    l'écriture et alerte le commercial responsable. Une affaire en cours passe sous le contrôle du
    commercial, qui décide de la suite avec un motif typé.

### Détection de coordonnées

30. **Règle MVP : on signale au commercial, on ne masque pas.** Le commercial est déjà dans le fil
    et voit tout en temps réel ; masquer automatiquement gênerait un échange légitime qu'il
    supervise, et donnerait aux parties l'envie de contourner la détection plutôt que de rester.
31. Le catalogue de motifs détectés, les niveaux de gravité et le traitement des alertes sont
    définis par `intermediation-tracking` — ne pas les réinventer ici.

---

## Étape 9 — Statut juridique, conservation et suppression

32. **Les échanges ne sont pas des correspondances privées : ce sont des échanges hébergés et
    supervisés.** Cette qualification doit figurer dans les CGU **et** être rappelée dans le
    produit avant le premier message, pas seulement dans un document que personne n'ouvre.
33. L'information doit couvrir : la présence permanente d'un commercial nommé, la possibilité de
    lecture par un autre agent INFLUX, la journalisation de ces lectures, et la durée de
    conservation.
34. **Validation obligatoire par `expert-conformite-rgpd` (veto) et par un juriste** avant la mise
    en ligne. Une supervision non annoncée est une supervision illicite.

### Conservation et suppression de compte

35. **Hypothèse conservatrice retenue, à faire valider** : une demande de suppression de compte
    entraîne une **suppression logique et l'anonymisation des données personnelles** du demandeur,
    mais **la conversation, l'affaire et le journal sont conservés sous forme pseudonymisée**, au
    titre de la constatation, de l'exercice et de la défense de droits en justice.
36. **Cette conservation doit figurer dans la politique de confidentialité dès le Lot 1.** Sans
    mention explicite, le droit de conserver la preuve n'existe pas — et le dispositif
    d'intermédiation perd son fondement.
37. La durée de conservation est bornée et écrite, jamais « indéfinie ».
38. Arbitre : `expert-conformite-rgpd` (**veto**), avec `expert-paiement-facturation` pour le sort
    d'une affaire en cours.

---

## Étape 10 — Traiter les cas limites

| Situation | Comportement attendu |
|---|---|
| Une partie supprime son compte | Le fil reste, pseudonymisé ; l'autre partie voit « Compte supprimé » ; le commercial est alerté ; l'affaire suit son état propre |
| Une partie est suspendue | Écriture fermée pour elle, lecture conservée, fil visible par le commercial, motif de suspension non divulgué à l'autre partie |
| Le commercial responsable est absent | Un autre agent peut lire (journalisé) et **s'ajouter** au fil, visiblement ; l'affaire peut être réattribuée (cf. `backoffice-ops`) |
| Le commercial quitte l'entreprise | Réattribution obligatoire avant désactivation du compte ; les messages passés conservent son nom |
| Conversation ouverte, aucune réponse | Relance automatique après un délai à fixer, puis mise en pause avec motif ; le silence prolongé alimente les alertes |
| Deux messages simultanés | Ordonnancement par horodatage serveur ; aucun message perdu ; affichage cohérent pour les trois participants |
| Service e-mail indisponible | **Le message existe malgré tout** ; la notification part en file et est rejouée (cf. `lead-pipeline`) ; l'échec est visible au backoffice |
| Conversation ouverte par erreur | Clôture avec motif « ouverture erronée » ; **la révélation d'identité, elle, reste** : elle a eu lieu et le journal le dit |
| Le créateur refuse après révélation | Le fil se clôt avec motif ; ce qui a été révélé reste révélé ; aucune donnée n'est « dé-révélée » |
| Une partie demande le contenu du fil | Traité comme une demande d'accès RGPD, par le backoffice, pas par un export sauvage |

---

## Checklist avant livraison

- [ ] Chaque conversation est rattachée à une mise en relation validée
- [ ] Trois participants dès l'origine, rôles et dates d'entrée explicites
- [ ] Ajout et départ d'un agent visibles et horodatés dans le fil
- [ ] Commercial identifié « Prénom — INFLUX », aucune écriture « au nom de »
- [ ] Rappel permanent de ce qui a été révélé, à qui et quand
- [ ] Masquage des coordonnées **symétrique** marque / créateur
- [ ] Aucune notification ne contient le texte d'un message
- [ ] Aucune pièce jointe au message ; canal de documents contrôlé spécifié
- [ ] Lecture par un agent non participant journalisée sans exception
- [ ] Motifs de clôture, de signalement et de blocage **typés**, listes fermées
- [ ] Détection de coordonnées : signalement au commercial, pas de masquage
- [ ] Statut juridique des échanges annoncé dans le produit et dans les CGU
- [ ] Conservation pseudonymisée écrite dans la politique de confidentialité
- [ ] Tous les cas limites du tableau traités, aucun laissé implicite
- [ ] Revue `expert-conformite-rgpd` (veto) demandée

## Format de sortie

**Déclencheur et mise en relation d'origine** → **Modèle** (conversation, participants, messages,
lectures) → **Cycle de vie et transitions** → **Matrice de visibilité avant / après révélation** →
**Notifications** → **Documents et interdiction des pièces jointes** → **Présence et lecture des
agents, journalisation** → **Signalement, blocage, détection** → **Statut juridique et
conservation** → **Cas limites** → **Critères d'acceptation** (Étant donné / Quand / Alors, via
`feature-spec`) → **Questions ouvertes avec leur arbitre**.

## Quand NE PAS invoquer cette skill

- **Notifications produit hors messagerie** (badge obtenu, campagne validée) → `feature-spec`.
- **E-mails marketing, segments, campagnes** → `brevo-campaign`.
- **Notes et commentaires internes** sur une fiche, invisibles des membres → `backoffice-ops`.
- **Preuve d'intermédiation, registre chaîné, pipeline d'affaire, catalogue de détection de
  coordonnées** → `intermediation-tracking`.
- **Tables, colonnes, RLS, rétention technique** → `supabase-schema`.
- **Apparence du fil, composants, densité** → `design-system-influx`.
- **Critères de sélection des créateurs à qui proposer** → `matching-spec`.

## Questions ouvertes

| # | Question | Arbitre |
|---|---|---|
| 1 | **D39 — SLA de la file de validation** : une conversation qui met 48 h à s'ouvrir tue la négociation | **Fondateur** + `product-owner` |
| 2 | **D30 — signalement des coordonnées et interdiction des pièces jointes** : confirmer « signaler, ne pas masquer » | `product-owner` + `expert-ux` + **Fondateur** |
| 3 | **Statut juridique des échanges** et lecture par tout agent au MVP | `expert-conformite-rgpd` (**veto**) + juriste |
| 4 | **Canal de documents** décrit à l'étape 7 : périmètre, qui peut déposer, délai de contrôle | **Fondateur** + `product-owner` |
| 5 | **Suppression de compte pendant une affaire en cours** : hypothèse conservatrice à confirmer | `expert-conformite-rgpd` (**veto**) + `expert-paiement-facturation` |
| 6 | Seuils de relance, de mise en pause et de regroupement des notifications | `product-owner` + `expert-ux` |
